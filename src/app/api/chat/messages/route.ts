import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gt, ne } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { initializeDatabase } from "@/lib/db";
import {
  chat_messages,
  chat_reads,
  chat_rooms,
  chat_typing,
  items,
  profiles,
} from "@/lib/schema";

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

  await db
    .insert(chat_rooms)
    .values({
      id: roomId,
      item_id: itemId,
      created_by: user.id,
    })
    .onConflictDoNothing();

  const rows = await db
    .select({
      id: chat_messages.id,
      body: chat_messages.body,
      created_at: chat_messages.created_at,
      sender_id: chat_messages.sender_id,
      sender_name: profiles.full_name,
      sender_email: profiles.email,
      referenced_item_id: chat_messages.referenced_item_id,
      referenced_item_title: items.title,
    })
    .from(chat_messages)
    .innerJoin(chat_rooms, eq(chat_messages.room_id, chat_rooms.id))
    .innerJoin(profiles, eq(chat_messages.sender_id, profiles.id))
    .leftJoin(items, eq(chat_messages.referenced_item_id, items.id))
    .where(eq(chat_messages.room_id, roomId))
    .orderBy(desc(chat_messages.created_at))
    .limit(100);

  await db
    .insert(chat_reads)
    .values({
      room_id: roomId,
      user_id: user.id,
      last_read_at: new Date(),
    })
    .onConflictDoUpdate({
      target: [chat_reads.room_id, chat_reads.user_id],
      set: {
        last_read_at: new Date(),
      },
    });

  const activeCutoff = new Date(Date.now() - 8000);
  const typingRows = await db
    .select({
      user_id: chat_typing.user_id,
      sender_name: profiles.full_name,
      sender_email: profiles.email,
    })
    .from(chat_typing)
    .innerJoin(profiles, eq(chat_typing.user_id, profiles.id))
    .where(
      and(
        eq(chat_typing.room_id, roomId),
        ne(chat_typing.user_id, user.id),
        gt(chat_typing.updated_at, activeCutoff)
      )
    );

  return NextResponse.json({
    messages: rows.reverse().map((row) => ({
      id: row.id,
      body: row.body,
      senderId: row.sender_id,
      senderName: row.sender_name || row.sender_email || "Unknown",
      createdAt: row.created_at ? row.created_at.toISOString() : new Date().toISOString(),
      referencedItemId: row.referenced_item_id,
      referencedItemTitle: row.referenced_item_title,
    })),
    typingUsers: typingRows.map((row) => ({
      userId: row.user_id,
      name: row.sender_name || row.sender_email || "Someone",
    })),
  });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null) as
    | { itemId?: string | null; message?: string; referencedItemId?: string | null }
    | null;

  const message = payload?.message?.trim();
  const itemId = payload?.itemId?.trim() || null;
  const referencedItemId = payload?.referencedItemId?.trim() || null;

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

  if (referencedItemId) {
    const referenced = await db
      .select({ id: items.id })
      .from(items)
      .where(eq(items.id, referencedItemId))
      .get();

    if (!referenced?.id) {
      return NextResponse.json({ error: "Referenced item not found" }, { status: 404 });
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
    referenced_item_id: referencedItemId,
  });

  await db
    .insert(chat_reads)
    .values({
      room_id: roomId,
      user_id: user.id,
      last_read_at: new Date(),
    })
    .onConflictDoUpdate({
      target: [chat_reads.room_id, chat_reads.user_id],
      set: {
        last_read_at: new Date(),
      },
    });

  await db
    .delete(chat_typing)
    .where(and(eq(chat_typing.room_id, roomId), eq(chat_typing.user_id, user.id)));

  const sent = await db
    .select({
      id: chat_messages.id,
      body: chat_messages.body,
      created_at: chat_messages.created_at,
      sender_id: chat_messages.sender_id,
      sender_name: profiles.full_name,
      sender_email: profiles.email,
      referenced_item_id: chat_messages.referenced_item_id,
      referenced_item_title: items.title,
    })
    .from(chat_messages)
    .innerJoin(profiles, eq(chat_messages.sender_id, profiles.id))
    .leftJoin(items, eq(chat_messages.referenced_item_id, items.id))
    .where(and(eq(chat_messages.id, messageId), eq(chat_messages.sender_id, user.id)))
    .get();

  return NextResponse.json({
    message: {
      id: sent?.id || messageId,
      body: sent?.body || message,
      senderId: sent?.sender_id || user.id,
      senderName: sent?.sender_name || sent?.sender_email || user.email,
      createdAt: sent?.created_at ? sent.created_at.toISOString() : new Date().toISOString(),
      referencedItemId: sent?.referenced_item_id || null,
      referencedItemTitle: sent?.referenced_item_title || null,
    },
  });
}
