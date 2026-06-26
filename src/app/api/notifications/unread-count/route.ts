import { NextRequest, NextResponse } from "next/server";
import { and, eq, count } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { initializeDatabase } from "@/lib/db";
import { notifications } from "@/lib/schema";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = initializeDatabase();

  const [{ unreadCount }] = await db
    .select({ unreadCount: count() })
    .from(notifications)
    .where(
      and(
        eq(notifications.user_id, user.id),
        eq(notifications.read, false)
      )
    );

  return NextResponse.json({ count: unreadCount });
}
