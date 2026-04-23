import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Proxy + cache for getyarn.io search. getyarn has no public JSON API, so we
// scrape the HTML search page server-side (browser CORS would block it
// anyway) and pull out the first few clip IDs. Clips are word-scoped so we
// cache them permanently on the Word row — one network call per word.
//
// Why getyarn: it indexes actual TV/movie subtitles and exposes embed URLs
// designed for third-party pages (https://getyarn.io/yarn-clip/<id>/embed).
//
// ?debug=1 returns getyarn's raw response metadata (status, length, preview,
// regex matches) so we can diagnose when a scrape yields zero clips on
// production — Vercel's egress might be rate-limited or the HTML shape may
// have drifted.

export const dynamic = "force-dynamic";

const MAX_CLIPS = 5;
// getyarn clip URLs take a few shapes:
//   /yarn-clip/<uuid>/<slug>
//   /yarn-clip/<uuid>
//   /yarn-clip/<uuid>.gif       (thumbnail links for previews)
// UUIDs look like 8-4-4-4-12 hex with dashes; mongo-id like 24 hex also
// appears sometimes. We accept any id-ish token up to the next /, ", ', ?,
// space, #, or backslash and dedupe.
const CLIP_RE = /\/yarn-clip\/([^"'\/\s?#\\.]+)/g;

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const word = (req.nextUrl.searchParams.get("word") ?? "").trim().toLowerCase();
  const debug = req.nextUrl.searchParams.get("debug") === "1";
  if (!word || word.length > 40 || !/^[a-z][a-z' -]*$/i.test(word)) {
    return NextResponse.json({ error: "invalid word" }, { status: 400 });
  }

  const existing = await prisma.word.findUnique({
    where: { lemma: word },
    select: { id: true, contextClipIds: true },
  });

  if (!debug && existing && existing.contextClipIds.length > 0) {
    return NextResponse.json({ clipIds: existing.contextClipIds, cached: true });
  }

  const target = `https://getyarn.io/yarn-find?text=${encodeURIComponent(word)}`;
  let status = 0;
  let bodyLen = 0;
  let preview = "";
  let clipIds: string[] = [];
  let errMsg: string | null = null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(target, {
      signal: controller.signal,
      headers: {
        "user-agent": UA,
        accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.8",
      },
    });
    clearTimeout(timer);
    status = res.status;
    const html = await res.text();
    bodyLen = html.length;
    preview = html.slice(0, 500);
    if (res.ok) {
      const seen = new Set<string>();
      for (const m of html.matchAll(CLIP_RE)) {
        const id = m[1];
        if (id.length < 6) continue; // skip short noise
        if (!seen.has(id)) {
          seen.add(id);
          clipIds.push(id);
          if (clipIds.length >= MAX_CLIPS) break;
        }
      }
    }
  } catch (e) {
    errMsg = e instanceof Error ? e.message : String(e);
  }

  console.log(
    `[clips/yarn] word=${word} status=${status} bodyLen=${bodyLen} clips=${clipIds.length}${
      errMsg ? ` err=${errMsg}` : ""
    }`
  );

  if (clipIds.length > 0 && existing) {
    await prisma.word.update({
      where: { id: existing.id },
      data: { contextClipIds: clipIds },
    });
  }

  if (debug) {
    return NextResponse.json({
      clipIds,
      cached: false,
      debug: {
        target,
        status,
        bodyLen,
        preview,
        regex: CLIP_RE.source,
        err: errMsg,
      },
    });
  }

  return NextResponse.json({ clipIds, cached: false });
}
