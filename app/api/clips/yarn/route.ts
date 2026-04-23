import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Proxy + cache for getyarn.io search. getyarn has no public JSON API, so we
// scrape the HTML search page server-side (browser CORS would block it
// anyway) and pull out the first few /yarn-clip/<id> URLs. Clips are word-
// scoped so we cache them permanently on the Word row — one network call
// per word, ever.
//
// Why getyarn: it indexes actual TV/movie subtitles and exposes embed URLs
// designed for third-party pages (https://getyarn.io/yarn-clip/<id>/embed).
// Official API would be nicer, but this works and fails gracefully (empty
// array → UI falls back to outbound search links).

export const dynamic = "force-dynamic";

const MAX_CLIPS = 5;
const CLIP_RE = /\/yarn-clip\/([A-Za-z0-9_-]{6,})/g;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const word = (req.nextUrl.searchParams.get("word") ?? "").trim().toLowerCase();
  if (!word || word.length > 40 || !/^[a-z][a-z' -]*$/i.test(word)) {
    return NextResponse.json({ error: "invalid word" }, { status: 400 });
  }

  const existing = await prisma.word.findUnique({
    where: { lemma: word },
    select: { id: true, contextClipIds: true },
  });

  // Cache hit — anything non-empty means we already looked it up once.
  if (existing && existing.contextClipIds.length > 0) {
    return NextResponse.json({ clipIds: existing.contextClipIds, cached: true });
  }

  let clipIds: string[] = [];
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      `https://getyarn.io/yarn-find?text=${encodeURIComponent(word)}`,
      {
        signal: controller.signal,
        headers: {
          "user-agent": UA,
          accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.8",
        },
      }
    );
    clearTimeout(timer);
    if (res.ok) {
      const html = await res.text();
      const seen = new Set<string>();
      for (const m of html.matchAll(CLIP_RE)) {
        const id = m[1];
        if (!seen.has(id)) {
          seen.add(id);
          clipIds.push(id);
          if (clipIds.length >= MAX_CLIPS) break;
        }
      }
    }
  } catch {
    // network timeout or fetch failure — treat as "no clips", don't persist
    // empty state so we can retry later.
  }

  if (clipIds.length > 0 && existing) {
    await prisma.word.update({
      where: { id: existing.id },
      data: { contextClipIds: clipIds },
    });
  }

  return NextResponse.json({ clipIds, cached: false });
}
