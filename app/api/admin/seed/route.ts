import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db";
import { youdaoAudio } from "@/lib/youdao";

// One-time seed endpoint — protected by ADMIN_SECRET header.
// curl -X POST -H "x-admin-secret: $SECRET" https://<domain>/api/admin/seed
export const runtime = "nodejs";
export const maxDuration = 60;

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

export async function POST(req: Request) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "ADMIN_SECRET not configured" },
      { status: 500 }
    );
  }
  if (req.headers.get("x-admin-secret") !== secret) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const jsonPath = path.join(process.cwd(), "data", "seed-words.json");
  let raw: string;
  try {
    raw = await fs.readFile(jsonPath, "utf-8");
  } catch {
    return NextResponse.json(
      { error: "data/seed-words.json not found in build output" },
      { status: 500 }
    );
  }
  const words: SeedWord[] = JSON.parse(raw);

  const existing = await prisma.word.count();
  if (existing > 0) {
    return NextResponse.json({
      skipped: true,
      message: `Already has ${existing} words. Call DELETE first to reseed.`,
    });
  }

  let inserted = 0;
  const CHUNK = 200;
  for (let i = 0; i < words.length; i += CHUNK) {
    const slice = words.slice(i, i + CHUNK);
    await prisma.$transaction(
      slice.map((w) =>
        prisma.word.create({
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
        })
      )
    );
    inserted += slice.length;
  }

  return NextResponse.json({ inserted, total: words.length });
}

export async function DELETE(req: Request) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || req.headers.get("x-admin-secret") !== secret) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  // Remove seeded words (cascades to Example, UserWord, ReviewLog, PlacementAnswer).
  const deleted = await prisma.word.deleteMany({});
  return NextResponse.json({ deleted: deleted.count });
}
