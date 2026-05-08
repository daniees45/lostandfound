import { NextResponse } from "next/server";
import { and, desc, inArray, ne, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { initializeDatabase } from "@/lib/db";
import { items } from "@/lib/schema";

const itemAlerts = [
  "Quick tip: reach out in chat with identifying details to speed up matching.",
  "Reminder: include location and date when discussing an item in chat.",
  "Safety note: do not share personal credentials in chat messages.",
  "Try asking for distinctive marks when verifying ownership.",
];

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = initializeDatabase();
  const randomRow = await db
    .select({
      id: items.id,
      title: items.title,
      location: items.location,
      status: items.status,
    })
    .from(items)
    .where(
      and(
        inArray(items.status, ["lost", "found", "held_at_pickup"] as const),
        ne(items.user_id, user.id)
      )
    )
    .orderBy(sql`random()`)
    .limit(1)
    .get();

  const randomTip = itemAlerts[Math.floor(Math.random() * itemAlerts.length)] || itemAlerts[0];

  if (!randomRow) {
    return NextResponse.json({
      alert: randomTip,
      itemId: null,
    });
  }

  return NextResponse.json({
    alert: `Random ${randomRow.status} item: ${randomRow.title} at ${randomRow.location}. ${randomTip}`,
    itemId: randomRow.id,
  });
}
