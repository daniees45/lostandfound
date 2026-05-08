"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type ChatMessage = {
  id: string;
  body: string;
  senderId: string;
  senderName: string;
  createdAt: string;
};

type ChatRoomProps = {
  currentUserId: string;
  itemId: string | null;
  itemTitle?: string;
};

export function ChatRoom({ currentUserId, itemId, itemTitle }: ChatRoomProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const title = useMemo(() => {
    if (itemTitle) return `Item chat: ${itemTitle}`;
    return "General Lost & Found chat";
  }, [itemTitle]);

  const fetchMessages = useCallback(async () => {
    const params = new URLSearchParams();
    if (itemId) params.set("itemId", itemId);
    const url = `/api/chat/messages${params.toString() ? `?${params.toString()}` : ""}`;

    try {
      const res = await fetch(url, {
        method: "GET",
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error("Could not load chat messages.");
      }

      const data = (await res.json()) as { messages: ChatMessage[] };
      setMessages(data.messages || []);
      setError(null);
    } catch {
      setError("Could not refresh messages. Retrying...");
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    void fetchMessages();
    const timer = setInterval(() => {
      void fetchMessages();
    }, 2000);
    return () => clearInterval(timer);
  }, [fetchMessages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function handleSend(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const message = draft.trim();
    if (!message) return;

    setSending(true);
    try {
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          itemId,
          message,
        }),
      });

      if (!res.ok) {
        throw new Error("Could not send message");
      }

      setDraft("");
      await fetchMessages();
    } catch {
      setError("Failed to send your message. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="rounded-2xl border border-sky-200 bg-white dark:border-sky-800 dark:bg-sky-950">
        <div className="border-b border-sky-200 px-5 py-4 dark:border-sky-800">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{title}</h1>
          <p className="mt-1 text-xs text-sky-700 dark:text-sky-300">
            Realtime polling every 2 seconds in Turso mode.
          </p>
        </div>

        <div className="h-[420px] overflow-y-auto px-4 py-4">
          {loading ? <p className="text-sm text-sky-600">Loading messages...</p> : null}
          {!loading && messages.length === 0 ? (
            <p className="text-sm text-sky-600">No messages yet. Start the conversation.</p>
          ) : null}

          <div className="space-y-3">
            {messages.map((message) => {
              const own = message.senderId === currentUserId;
              return (
                <div
                  key={message.id}
                  className={`flex ${own ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${
                      own
                        ? "bg-sky-600 text-white"
                        : "bg-sky-100 text-sky-900 dark:bg-sky-900 dark:text-sky-100"
                    }`}
                  >
                    <p className="text-[11px] opacity-80">{message.senderName}</p>
                    <p className="mt-0.5 whitespace-pre-wrap">{message.body}</p>
                    <p className="mt-1 text-[10px] opacity-70">
                      {new Date(message.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
        </div>

        <form
          onSubmit={(e) => {
            void handleSend(e);
          }}
          className="border-t border-sky-200 p-4 dark:border-sky-800"
        >
          {error ? (
            <p className="mb-2 rounded-md bg-rose-100 px-3 py-2 text-xs text-rose-700">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={1000}
              placeholder="Type your message..."
              className="flex-1 rounded-md border border-sky-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-400 dark:border-sky-700 dark:bg-sky-950"
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? "Sending..." : "Send"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
