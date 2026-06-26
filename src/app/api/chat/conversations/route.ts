import { NextRequest, NextResponse } from "next/server";
import { eq, or, desc, inArray } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { initializeDatabase } from "@/lib/db";
import { claims, items, profiles, chat_messages } from "@/lib/schema";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = initializeDatabase();

  // 1. Fetch claims where the user is claimant
  const myClaims = await db
    .select({
      claimId: claims.id,
      itemTitle: items.title,
      otherUserId: items.user_id,
      otherUserName: profiles.full_name,
      otherUserEmail: profiles.email,
    })
    .from(claims)
    .innerJoin(items, eq(claims.item_id, items.id))
    .innerJoin(profiles, eq(items.user_id, profiles.id))
    .where(eq(claims.claimant_id, user.id));

  // 2. Fetch claims on the user's items
  const claimsOnMyItems = await db
    .select({
      claimId: claims.id,
      itemTitle: items.title,
      otherUserId: claims.claimant_id,
      otherUserName: profiles.full_name,
      otherUserEmail: profiles.email,
    })
    .from(claims)
    .innerJoin(items, eq(claims.item_id, items.id))
    .innerJoin(profiles, eq(claims.claimant_id, profiles.id))
    .where(eq(items.user_id, user.id));

  // Combine and deduplicate
  const allConversationsMap = new Map();
  [...myClaims, ...claimsOnMyItems].forEach((conv) => {
    if (!allConversationsMap.has(`claim_${conv.claimId}`)) {
      allConversationsMap.set(`claim_${conv.claimId}`, {
        id: conv.claimId,
        type: "claim",
        itemTitle: conv.itemTitle,
        otherUserName: conv.otherUserName || conv.otherUserEmail || "Unknown User",
        latestMessageBody: null as string | null,
        latestMessageCreatedAt: null as string | null,
        roomId: `room_claim_${conv.claimId}`,
      });
    }
  });

  // 3. Fetch items the user owns
  const myItems = await db
    .select({
      itemId: items.id,
      itemTitle: items.title,
    })
    .from(items)
    .where(eq(items.user_id, user.id));

  // 4. Fetch item chats where the user has sent a message
  const myMessageRooms = await db
    .selectDistinct({ room_id: chat_messages.room_id })
    .from(chat_messages)
    .where(eq(chat_messages.sender_id, user.id));

  // Get item ids from room ids (room_item_{id})
  const participatedItemIds = myMessageRooms
    .filter((r) => r.room_id && r.room_id.startsWith("room_item_"))
    .map((r) => r.room_id!.replace("room_item_", ""));

  const participatedItems = participatedItemIds.length > 0 
    ? await db
        .select({ itemId: items.id, itemTitle: items.title })
        .from(items)
        .where(inArray(items.id, participatedItemIds))
    : [];

  [...myItems, ...participatedItems].forEach((item) => {
    if (!allConversationsMap.has(`item_${item.itemId}`)) {
      allConversationsMap.set(`item_${item.itemId}`, {
        id: item.itemId,
        type: "item",
        itemTitle: item.itemTitle,
        otherUserName: "Item Chat", // Generic name since it's a lobby
        latestMessageBody: null as string | null,
        latestMessageCreatedAt: null as string | null,
        roomId: `room_item_${item.itemId}`,
      });
    }
  });

  const conversations = Array.from(allConversationsMap.values());

  if (conversations.length > 0) {
    const roomIds = conversations.map((c) => c.roomId);

    // Fetch the latest message for these rooms
    // Since we just want the latest, we can fetch messages for these rooms and group them in memory
    // (SQLite via Drizzle doesn't have an easy LAST_VALUE window function out of the box)
    const messages = await db
      .select({
        room_id: chat_messages.room_id,
        body: chat_messages.body,
        created_at: chat_messages.created_at,
      })
      .from(chat_messages)
      .where(inArray(chat_messages.room_id, roomIds))
      .orderBy(desc(chat_messages.created_at));

    // Map messages back to conversations
    for (const msg of messages) {
      if (!msg.room_id) continue;
      
      const convKey = msg.room_id.startsWith("room_claim_") 
        ? `claim_${msg.room_id.replace("room_claim_", "")}`
        : `item_${msg.room_id.replace("room_item_", "")}`;
        
      const conv = allConversationsMap.get(convKey);
      if (conv && !conv.latestMessageBody) {
        conv.latestMessageBody = msg.body;
        conv.latestMessageCreatedAt = msg.created_at ? msg.created_at.toISOString() : null;
      }
    }
  }

  // Sort conversations by latest message date (descending), then fallback to claimId
  conversations.sort((a, b) => {
    if (a.latestMessageCreatedAt && b.latestMessageCreatedAt) {
      return new Date(b.latestMessageCreatedAt).getTime() - new Date(a.latestMessageCreatedAt).getTime();
    }
    if (a.latestMessageCreatedAt) return -1;
    if (b.latestMessageCreatedAt) return 1;
    return 0;
  });

  return NextResponse.json({ conversations });
}
