import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { initializeDatabase } from "@/lib/db";
import { items } from "@/lib/schema";
import { ChatRoom } from "@/components/chat-room";

type ChatPageProps = {
  searchParams: Promise<{
    itemId?: string;
  }>;
};

export default async function ChatPage({ searchParams }: ChatPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth/login?redirectTo=/chat");
  }

  const params = await searchParams;
  const itemId = params.itemId?.trim() || null;

  let itemTitle: string | undefined;
  if (itemId) {
    const db = initializeDatabase();
    const item = await db
      .select({ title: items.title })
      .from(items)
      .where(eq(items.id, itemId))
      .get();
    itemTitle = item?.title;
  }

  return <ChatRoom currentUserId={user.id} itemId={itemId} itemTitle={itemTitle} />;
}
