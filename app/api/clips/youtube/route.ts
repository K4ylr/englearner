import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Search YouTube via Data API v3 for short, embeddable clips where the word
// is spoken in context (TV/movie scenes, vocabulary explanations, etc.). We
// cache the top video IDs per-word on Word.contextClipIds so we only hit
// YouTube quota once per lemma, ever. The client then embeds each via
// https://www.youtube.com/embed/<id>, which YouTube officially supports on
// third-party sites.
//
// Why not scrape a TV-subtitle site (getyarn, playphrase): both sit behind
// Cloudflare and return an anti-bot challenge (403 "Just a moment...") for
// Vercel's serverless IPs.
//
// YOUTUBE_API_KEY env var is required. Free tier is 10,000 units/day; a
// search costs 100 units = 100 fresh lookups/day. Cached words don't hit
// the API.
//
// ?debug=1 returns YouTube's raw response metadata so we can diagnose
// empty results (quota exhausted, key invalid, etc.).

export const dynamic = "force-dynamic";

const MAX_CLIPS = 5;

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
    return NextResponse.json({ videoIds: existing.contextClipIds, cached: true });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      videoIds: [],
      cached: false,
      error: "YOUTUBE_API_KEY not configured",
    });
  }

  // Quote the word so YouTube treats it as a phrase match; append "scene"
  // to bias toward TV/movie clips over lectures.
  const query = `"${word}" scene`;
  const url =
    `https://www.googleapis.com/youtube/v3/search?part=id` +
    `&type=video` +
    `&videoEmbeddable=true` +
    `&videoDuration=short` +
    `&maxResults=${MAX_CLIPS}` +
    `&q=${encodeURIComponent(query)}` +
    `&key=${apiKey}`;

  let status = 0;
  let body: unknown = null;
  let videoIds: string[] = [];
  let errMsg: string | null = null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    status = res.status;
    body = await res.json();
    if (res.ok && body && typeof body === "object" && "items" in body) {
      const items = (body as { items?: Array<{ id?: { videoId?: string } }> })
        .items ?? [];
      for (const it of items) {
        const vid = it.id?.videoId;
        if (vid && !videoIds.includes(vid)) {
          videoIds.push(vid);
          if (videoIds.length >= MAX_CLIPS) break;
        }
      }
    }
  } catch (e) {
    errMsg = e instanceof Error ? e.message : String(e);
  }

  console.log(
    `[clips/youtube] word=${word} status=${status} clips=${videoIds.length}${
      errMsg ? ` err=${errMsg}` : ""
    }`
  );

  if (videoIds.length > 0 && existing) {
    await prisma.word.update({
      where: { id: existing.id },
      data: { contextClipIds: videoIds },
    });
  }

  if (debug) {
    return NextResponse.json({
      videoIds,
      cached: false,
      debug: { query, status, err: errMsg, raw: body },
    });
  }

  return NextResponse.json({ videoIds, cached: false });
}
