import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { initializeDatabase } from "@/lib/db";
import { claims, items } from "@/lib/schema";
import { ChatRoom } from "@/components/chat-room";
import Link from "next/link";

type ChatPageProps = {
  searchParams: Promise<{
    itemId?: string;
    refItemId?: string;
    claimId?: string;
  }>;
};

export default async function ChatPage({ searchParams }: ChatPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth/login?redirectTo=/chat");
  }

  const params = await searchParams;
  let itemId = params.itemId?.trim() || null;
  const claimId = params.claimId?.trim() || null;
  let refItemId = params.refItemId?.trim() || itemId;

  const db = initializeDatabase();

  let claimChatTitle: string | undefined;
  if (claimId) {
    const claim = await db
      .select({
        id: claims.id,
        item_id: claims.item_id,
        claimant_id: claims.claimant_id,
        item_owner_id: items.user_id,
        item_title: items.title,
      })
      .from(claims)
      .innerJoin(items, eq(claims.item_id, items.id))
      .where(eq(claims.id, claimId))
      .get();

    if (!claim) {
      redirect("/dashboard?claimSuccess=0&claimMessage=Claim%20chat%20not%20found.");
    }

    const canAccessClaimChat = user.id === claim.claimant_id || user.id === claim.item_owner_id;
    if (!canAccessClaimChat) {
      redirect("/dashboard?claimSuccess=0&claimMessage=You%20cannot%20access%20this%20claim%20chat.");
    }

    itemId = claim.item_id;
    refItemId = claim.item_id;
    claimChatTitle = `Claim chat: ${claim.item_title}`;
  }

  const pickerRows = await db
    .select({ id: items.id, title: items.title, status: items.status })
    .from(items)
    .orderBy(items.created_at)
    .limit(100);

  const pickerItems = pickerRows.map((row) => ({
    id: row.id,
    label: `${row.title} (${row.status})`,
  }));

  let itemTitle: string | undefined;
  let referencedItemTitle: string | undefined;
  if (itemId || refItemId) {
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

  // Sidebar data queries
  const myClaims = await db
    .select({ id: claims.id, itemTitle: items.title })
    .from(claims)
    .innerJoin(items, eq(claims.item_id, items.id))
    .where(eq(claims.claimant_id, user.id));

  const claimsOnMyItems = await db
    .select({ id: claims.id, itemTitle: items.title })
    .from(claims)
    .innerJoin(items, eq(claims.item_id, items.id))
    .where(eq(items.user_id, user.id));

  const privateChats = [...myClaims, ...claimsOnMyItems].reduce((acc, current) => {
    const x = acc.find((item) => item.id === current.id);
    if (!x) {
      return acc.concat([current]);
    } else {
      return acc;
    }
  }, [] as typeof myClaims);

  return (
    <div className="mx-auto flex h-[calc(100vh-5rem)] max-w-7xl overflow-hidden pt-6 px-4 sm:px-6 lg:px-8">
      <aside className="hidden w-64 overflow-y-auto rounded-l-2xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-800 dark:bg-sky-900/50 md:block">
        <h2 className="mb-4 text-lg font-semibold text-sky-900 dark:text-sky-100">Your Chats</h2>

        <div className="space-y-6">
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-sky-500">General</h3>
            <Link
              href="/chat"
              className={`block truncate rounded-md px-3 py-2 text-sm transition-colors ${
                !itemId && !claimId
                  ? "bg-sky-200 font-medium text-sky-900 dark:bg-sky-800 dark:text-sky-100"
                  : "text-sky-700 hover:bg-sky-100 dark:text-sky-300 dark:hover:bg-sky-800/50"
              }`}
            >
              General Chat
            </Link>
          </div>

          {privateChats.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-sky-500">Private Chats</h3>
              {privateChats.map((claim) => (
                <Link
                  key={claim.id}
                  href={`/chat?claimId=${claim.id}`}
                  className={`block truncate rounded-md px-3 py-2 text-sm transition-colors ${
                    claimId === claim.id
                      ? "bg-sky-200 font-medium text-sky-900 dark:bg-sky-800 dark:text-sky-100"
                      : "text-sky-700 hover:bg-sky-100 dark:text-sky-300 dark:hover:bg-sky-800/50"
                  }`}
                >
                  Claim: {claim.itemTitle}
                </Link>
              ))}
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto rounded-2xl md:rounded-l-none md:border-l-0 border border-sky-200 bg-white dark:border-sky-800 dark:bg-sky-950">
        <ChatRoom
          currentUserId={user.id}
          itemId={itemId}
          claimId={claimId}
          claimChatTitle={claimChatTitle}
          itemTitle={itemTitle}
          initialReferencedItemId={refItemId}
          initialReferencedItemTitle={referencedItemTitle}
          availableItems={pickerItems}
        />
      </main>
    </div>
  );
}
