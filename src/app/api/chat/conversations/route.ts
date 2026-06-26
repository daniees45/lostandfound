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
    if (!allConversationsMap.has(conv.claimId)) {
      allConversationsMap.set(conv.claimId, {
        claimId: conv.claimId,
        itemTitle: conv.itemTitle,
        otherUserId: conv.otherUserId,
        otherUserName: conv.otherUserName || conv.otherUserEmail || "Unknown User",
        latestMessageBody: null as string | null,
        latestMessageCreatedAt: null as string | null,
      });
    }
  });

  const conversations = Array.from(allConversationsMap.values());

  if (conversations.length > 0) {
    const roomIds = conversations.map((c) => `room_claim_${c.claimId}`);

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
      const claimId = msg.room_id.replace("room_claim_", "");
      const conv = allConversationsMap.get(claimId);
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
