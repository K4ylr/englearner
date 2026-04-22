import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTodayQueue } from "@/lib/scheduler";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const queue = await getTodayQueue(session.user.id);
  return NextResponse.json({ queue });
}
