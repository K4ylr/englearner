// Placeholder seed — real ECDICT import lands in Phase B.
// Run with: pnpm db:seed
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.word.count();
  if (count > 0) {
    console.log(`[seed] ${count} words already present, skipping.`);
    return;
  }
  // TODO(Phase B): import ECDICT CSV via scripts/build-wordlist.ts
  console.log("[seed] Phase A: no words imported yet.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
