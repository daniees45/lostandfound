import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { initializeDatabase } from "@/lib/db";
import { chat_messages, chat_rooms, items, profiles } from "@/lib/schema";

function getRoomId(itemId: string | null) {
  return itemId ? `room_item_${itemId}` : "room_lobby";
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const itemId = request.nextUrl.searchParams.get("itemId");
  const roomId = getRoomId(itemId);
  const db = initializeDatabase();

  const rows = await db
    .select({
      id: chat_messages.id,
      body: chat_messages.body,
      created_at: chat_messages.created_at,
      sender_id: chat_messages.sender_id,
      sender_name: profiles.full_name,
      sender_email: profiles.email,
    })
    .from(chat_messages)
    .innerJoin(chat_rooms, eq(chat_messages.room_id, chat_rooms.id))
    .innerJoin(profiles, eq(chat_messages.sender_id, profiles.id))
    .where(eq(chat_messages.room_id, roomId))
    .orderBy(desc(chat_messages.created_at))
    .limit(100);

  return NextResponse.json({
    messages: rows.reverse().map((row) => ({
      id: row.id,
      body: row.body,
      senderId: row.sender_id,
      senderName: row.sender_name || row.sender_email || "Unknown",
      createdAt: row.created_at ? row.created_at.toISOString() : new Date().toISOString(),
    })),
  });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null) as
    | { itemId?: string | null; message?: string }
    | null;

  const message = payload?.message?.trim();
  const itemId = payload?.itemId?.trim() || null;

  if (!message) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  if (message.length > 1000) {
    return NextResponse.json({ error: "Message is too long" }, { status: 400 });
  }

  const db = initializeDatabase();

  if (itemId) {
    const item = await db
      .select({ id: items.id })
      .from(items)
      .where(eq(items.id, itemId))
      .get();

    if (!item?.id) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
  }

  const roomId = getRoomId(itemId);

  await db
    .insert(chat_rooms)
    .values({
      id: roomId,
      item_id: itemId,
      created_by: user.id,
    })
    .onConflictDoNothing();

  const messageId = `msg_${randomUUID()}`;
  await db.insert(chat_messages).values({
    id: messageId,
    room_id: roomId,
    sender_id: user.id,
    body: message,
  });

  const sent = await db
    .select({
      id: chat_messages.id,
      body: chat_messages.body,
      created_at: chat_messages.created_at,
      sender_id: chat_messages.sender_id,
      sender_name: profiles.full_name,
      sender_email: profiles.email,
    })
    .from(chat_messages)
    .innerJoin(profiles, eq(chat_messages.sender_id, profiles.id))
    .where(and(eq(chat_messages.id, messageId), eq(chat_messages.sender_id, user.id)))
    .get();

  return NextResponse.json({
    message: {
      id: sent?.id || messageId,
      body: sent?.body || message,
      senderId: sent?.sender_id || user.id,
      senderName: sent?.sender_name || sent?.sender_email || user.email,
      createdAt: sent?.created_at ? sent.created_at.toISOString() : new Date().toISOString(),
    },
  });
}
