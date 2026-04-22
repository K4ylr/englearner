import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db";
import { youdaoAudio } from "@/lib/youdao";

// Idempotent chunked seed endpoint. Call it repeatedly until { done: true }.
// Protected by ADMIN_SECRET header.
//   curl -X POST -H "x-admin-secret: $SECRET" https://<domain>/api/admin/seed
// Each call inserts words that don't yet exist in the DB, up to BATCH_SIZE.
export const runtime = "nodejs";
export const maxDuration = 60;

// How many words to insert per HTTP call. Each insert does a Word upsert +
// optional Example inserts so we stay well under Vercel's 60s limit.
const BATCH_SIZE = 2000;

type SeedWord = {
  lemma: string;
  pos?: string | null;
  ipaUs?: string | null;
  ipaUk?: string | null;
  defEn?: string | null;
  defZh?: string | null;
  cefr?: string | null;
  freqRank?: number | null;
  tags?: string[];
  topics?: string[];
  examples?: { en: string; zh?: string | null }[];
};

async function loadSeed(): Promise<SeedWord[]> {
  const jsonPath = path.join(process.cwd(), "data", "seed-words.json");
  const raw = await fs.readFile(jsonPath, "utf-8");
  return JSON.parse(raw);
}

function authed(req: Request): boolean {
  const secret = process.env.ADMIN_SECRET;
  return !!secret && req.headers.get("x-admin-secret") === secret;
}

export async function POST(req: Request) {
  if (!authed(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let words: SeedWord[];
  try {
    words = await loadSeed();
  } catch {
    return NextResponse.json(
      { error: "data/seed-words.json not found in build output" },
      { status: 500 }
    );
  }

  // Figure out what's already in the DB so we can skip it. Use Set for O(1)
  // membership check against the seed list.
  const existingRows = await prisma.word.findMany({ select: { lemma: true } });
  const existing = new Set(existingRows.map((r) => r.lemma));

  const remaining = words.filter((w) => !existing.has(w.lemma));
  if (remaining.length === 0) {
    return NextResponse.json({
      done: true,
      totalInDb: existingRows.length,
      totalInSeed: words.length,
    });
  }

  const batch = remaining.slice(0, BATCH_SIZE);
  let inserted = 0;

  // Use a plain loop (not $transaction) so that a bad row doesn't kill the
  // whole batch — each word is its own unit of work. Duplicate-lemma errors
  // are rare since we pre-filtered, but be tolerant of them.
  const CHUNK = 100;
  for (let i = 0; i < batch.length; i += CHUNK) {
    const slice = batch.slice(i, i + CHUNK);
    await Promise.all(
      slice.map(async (w) => {
        try {
          await prisma.word.create({
            data: {
              lemma: w.lemma,
              pos: w.pos ?? null,
              ipaUs: w.ipaUs ?? null,
              ipaUk: w.ipaUk ?? null,
              defEn: w.defEn ?? null,
              defZh: w.defZh ?? null,
              cefr: w.cefr ?? null,
              freqRank: w.freqRank ?? null,
              tags: w.tags ?? [],
              topics: w.topics ?? [],
              audioUs: youdaoAudio(w.lemma, "us"),
              audioUk: youdaoAudio(w.lemma, "uk"),
              examples: w.examples
                ? {
                    create: w.examples.map((e) => ({
                      en: e.en,
                      zh: e.zh ?? null,
                      source: "seed",
                    })),
                  }
                : undefined,
            },
          });
          inserted++;
        } catch {
          // Ignore dupe / race inserts — next call will see them as existing.
        }
      })
    );
  }

  const totalAfter = existingRows.length + inserted;
  return NextResponse.json({
    inserted,
    totalInDb: totalAfter,
    totalInSeed: words.length,
    done: totalAfter >= words.length,
  });
}

export async function DELETE(req: Request) {
  if (!authed(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  // Cascades to Example, UserWord, ReviewLog, PlacementAnswer.
  const deleted = await prisma.word.deleteMany({});
  return NextResponse.json({ deleted: deleted.count });
}
