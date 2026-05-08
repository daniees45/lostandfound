import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { initializeDatabase } from "@/lib/db";
import { items } from "@/lib/schema";
import { ChatRoom } from "@/components/chat-room";

type ChatPageProps = {
  searchParams: Promise<{
    itemId?: string;
    refItemId?: string;
  }>;
};

export default async function ChatPage({ searchParams }: ChatPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth/login?redirectTo=/chat");
  }

  const params = await searchParams;
  const itemId = params.itemId?.trim() || null;
  const refItemId = params.refItemId?.trim() || itemId;

  let itemTitle: string | undefined;
  let referencedItemTitle: string | undefined;
  if (itemId || refItemId) {
    const db = initializeDatabase();
    if (itemId) {
      const item = await db
        .select({ title: items.title })
        .from(items)
        .where(eq(items.id, itemId))
        .get();
      itemTitle = item?.title;
    }

    if (refItemId) {
      const refItem = await db
        .select({ title: items.title })
        .from(items)
        .where(eq(items.id, refItemId))
        .get();
      referencedItemTitle = refItem?.title;
    }
  }

  return (
    <ChatRoom
      currentUserId={user.id}
      itemId={itemId}
      itemTitle={itemTitle}
      initialReferencedItemId={refItemId}
      initialReferencedItemTitle={referencedItemTitle}
    />
  );
}
