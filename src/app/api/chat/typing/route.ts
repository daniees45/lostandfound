import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { initializeDatabase } from "@/lib/db";
import { claims, chat_rooms, chat_typing, items } from "@/lib/schema";

async function resolveRoomContext(params: {
  db: ReturnType<typeof initializeDatabase>;
  userId: string;
  itemId: string | null;
  claimId: string | null;
}) {
  const { db, userId, itemId, claimId } = params;

  if (claimId) {
    const claim = await db
      .select({
        id: claims.id,
        item_id: claims.item_id,
        claimant_id: claims.claimant_id,
        item_owner_id: items.user_id,
      })
      .from(claims)
      .innerJoin(items, eq(claims.item_id, items.id))
      .where(eq(claims.id, claimId))
      .get();

    if (!claim) {
      return { error: "Claim not found", status: 404 as const };
    }

    const canAccessClaimChat = userId === claim.claimant_id || userId === claim.item_owner_id;
    if (!canAccessClaimChat) {
      return { error: "Forbidden", status: 403 as const };
    }

    return {
      roomId: `room_claim_${claim.id}`,
      roomItemId: claim.item_id,
    };
  }

  return {
    roomId: itemId ? `room_item_${itemId}` : "room_lobby",
    roomItemId: itemId,
  };
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as
    | { itemId?: string | null; claimId?: string | null; typing?: boolean }
    | null;

  const itemId = payload?.itemId?.trim() || null;
  const claimId = payload?.claimId?.trim() || null;
  const isTyping = Boolean(payload?.typing);
  const db = initializeDatabase();

  const roomContext = await resolveRoomContext({
    db,
    userId: user.id,
    itemId,
    claimId,
  });

  if ("error" in roomContext) {
    return NextResponse.json({ error: roomContext.error }, { status: roomContext.status });
  }

  const roomId = roomContext.roomId;

  await db
    .insert(chat_rooms)
    .values({
      id: roomId,
      item_id: roomContext.roomItemId,
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
