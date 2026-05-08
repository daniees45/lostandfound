import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { initializeDatabase } from "@/lib/db";
import { chat_rooms, chat_typing } from "@/lib/schema";

function getRoomId(itemId: string | null) {
  return itemId ? `room_item_${itemId}` : "room_lobby";
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as
    | { itemId?: string | null; typing?: boolean }
    | null;

  const itemId = payload?.itemId?.trim() || null;
  const roomId = getRoomId(itemId);
  const isTyping = Boolean(payload?.typing);
  const db = initializeDatabase();

  await db
    .insert(chat_rooms)
    .values({
      id: roomId,
      item_id: itemId,
      created_by: user.id,
    })
    .onConflictDoNothing();

  if (!isTyping) {
    await db
      .delete(chat_typing)
      .where(and(eq(chat_typing.room_id, roomId), eq(chat_typing.user_id, user.id)));
    return NextResponse.json({ ok: true });
  }

  await db
    .insert(chat_typing)
    .values({
      room_id: roomId,
      user_id: user.id,
      updated_at: new Date(),
    })
    .onConflictDoUpdate({
      target: [chat_typing.room_id, chat_typing.user_id],
      set: {
        updated_at: new Date(),
      },
    });

  return NextResponse.json({ ok: true });
}
