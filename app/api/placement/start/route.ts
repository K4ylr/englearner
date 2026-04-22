import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildPlacementSet } from "@/lib/placement";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const cards = await buildPlacementSet(session.user.id);
  return NextResponse.json({ cards });
}
