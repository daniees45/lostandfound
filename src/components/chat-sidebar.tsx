"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type Conversation = {
  claimId: string;
  itemTitle: string;
  otherUserId: string;
  otherUserName: string;
  latestMessageBody: string | null;
  latestMessageCreatedAt: string | null;
};

export function ChatSidebar() {
  const searchParams = useSearchParams();
  const currentClaimId = searchParams?.get("claimId");
  const currentItemId = searchParams?.get("itemId");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function fetchConversations() {
      try {
        const res = await fetch("/api/chat/conversations");
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        if (mounted) {
          setConversations(data.conversations || []);
          setLoading(false);
        }
      } catch (err) {
        console.error("Error fetching conversations:", err);
        if (mounted) setLoading(false);
      }
    }

    fetchConversations();

    // Poll every 10 seconds for new messages or conversations
    const interval = setInterval(fetchConversations, 10000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <aside className="hidden w-64 flex-col overflow-hidden rounded-l-2xl border border-sky-200 bg-sky-50 dark:border-sky-800 dark:bg-sky-900/50 md:flex">
      <div className="border-b border-sky-200 p-4 dark:border-sky-800">
        <h2 className="text-lg font-semibold text-sky-900 dark:text-sky-100">Your Chats</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-sky-500">General</h3>
          <Link
            href="/chat"
            className={`block truncate rounded-md px-3 py-2 text-sm transition-colors ${
              !currentItemId && !currentClaimId
                ? "bg-sky-200 font-medium text-sky-900 dark:bg-sky-800 dark:text-sky-100"
                : "text-sky-700 hover:bg-sky-100 dark:text-sky-300 dark:hover:bg-sky-800/50"
            }`}
          >
            General Chat
          </Link>
        </div>

        <div>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-sky-500">Private Chats</h3>
          
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse rounded-md bg-sky-200/50 p-3 dark:bg-sky-800/30">
                  <div className="mb-2 h-4 w-3/4 rounded bg-sky-300 dark:bg-sky-700"></div>
                  <div className="h-3 w-full rounded bg-sky-200 dark:bg-sky-800"></div>
                </div>
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <p className="px-3 text-xs text-sky-600 dark:text-sky-400">No private chats yet.</p>
          ) : (
            <div className="space-y-1">
              {conversations.map((conv) => (
                <Link
                  key={conv.claimId}
                  href={`/chat?claimId=${conv.claimId}`}
                  className={`block rounded-md px-3 py-2 transition-colors ${
                    currentClaimId === conv.claimId
                      ? "bg-sky-200 text-sky-900 dark:bg-sky-800 dark:text-sky-100"
                      : "text-sky-700 hover:bg-sky-100 dark:text-sky-300 dark:hover:bg-sky-800/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate font-medium text-sm">{conv.otherUserName}</span>
                  </div>
                  <div className="mt-0.5 text-xs opacity-75 truncate">
                    {conv.itemTitle}
                  </div>
                  {conv.latestMessageBody && (
                    <div className="mt-1 text-xs opacity-60 truncate">
                      {conv.latestMessageBody}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
