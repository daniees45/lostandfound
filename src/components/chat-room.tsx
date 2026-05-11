"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type ChatMessage = {
  id: string;
  body: string;
  senderId: string;
  senderName: string;
  createdAt: string;
  referencedItemId?: string | null;
  referencedItemTitle?: string | null;
};

type TypingUser = {
  userId: string;
  name: string;
};

type ChatRoomProps = {
  currentUserId: string;
  itemId: string | null;
  itemTitle?: string;
  initialReferencedItemId?: string | null;
  initialReferencedItemTitle?: string;
  availableItems: Array<{ id: string; label: string }>;
};

export function ChatRoom({
  currentUserId,
  itemId,
  itemTitle,
  initialReferencedItemId,
  initialReferencedItemTitle,
  availableItems,
}: ChatRoomProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [chatAlert, setChatAlert] = useState<string | null>(null);
  const [randomAlert, setRandomAlert] = useState<string | null>(null);
  const [referencedItemId, setReferencedItemId] = useState<string>(initialReferencedItemId || "");
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const latestMessageIdRef = useRef<string | null>(null);
  const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingPulseRef = useRef(0);

  const title = useMemo(() => {
    if (itemTitle) return `Item chat: ${itemTitle}`;
    return "General Lost & Found chat";
  }, [itemTitle]);

  const sendTypingStatus = useCallback(
    async (typing: boolean) => {
      try {
        await fetch("/api/chat/typing", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ itemId, typing }),
        });
      } catch {
        // best effort only
      }
    },
    [itemId]
  );

  const maybeNotify = useCallback((titleText: string, body: string) => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "granted") {
      new Notification(titleText, { body });
    }
  }, []);

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

      const data = (await res.json()) as {
        messages: ChatMessage[];
        typingUsers?: TypingUser[];
      };
      const nextMessages = data.messages || [];
      const lastMessage = nextMessages[nextMessages.length - 1];

      if (
        lastMessage &&
        latestMessageIdRef.current &&
        lastMessage.id !== latestMessageIdRef.current &&
        lastMessage.senderId !== currentUserId
      ) {
        const text = `New message from ${lastMessage.senderName}`;
        setChatAlert(text);
        maybeNotify("New chat message", `${lastMessage.senderName}: ${lastMessage.body.slice(0, 90)}`);
      }

      latestMessageIdRef.current = lastMessage?.id || latestMessageIdRef.current;
      setMessages(nextMessages);
      setTypingUsers(data.typingUsers || []);
      setError(null);
    } catch {
      setError("Could not refresh messages. Retrying...");
    } finally {
      setLoading(false);
    }
  }, [currentUserId, itemId, maybeNotify]);

  const fetchRandomItemAlert = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/random-item-message", {
        method: "GET",
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { alert?: string };
      if (data.alert) {
        setRandomAlert(data.alert);
      }
    } catch {
      // ignore alert fetch issues
    }
  }, []);

  useEffect(() => {
    void fetchMessages();
    const timer = setInterval(() => {
      void fetchMessages();
    }, 2000);
    return () => clearInterval(timer);
  }, [fetchMessages]);

  useEffect(() => {
    void fetchRandomItemAlert();
    const timer = setInterval(() => {
      void fetchRandomItemAlert();
    }, 45000);
    return () => clearInterval(timer);
  }, [fetchRandomItemAlert]);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    return () => {
      void sendTypingStatus(false);
    };
  }, [sendTypingStatus]);

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
          referencedItemId: referencedItemId || null,
        }),
      });

      if (!res.ok) {
        throw new Error("Could not send message");
      }

      setDraft("");
      await sendTypingStatus(false);
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
          
          {chatAlert ? (
            <p className="mt-2 rounded-md bg-amber-100 px-2 py-1 text-xs text-amber-900">
              {chatAlert}
            </p>
          ) : null}
          {randomAlert ? (
            <p className="mt-2 rounded-md bg-sky-100 px-2 py-1 text-xs text-sky-800 dark:bg-sky-900 dark:text-sky-100">
              {randomAlert}
            </p>
          ) : null}
          {initialReferencedItemTitle ? (
            <p className="mt-2 rounded-md bg-emerald-100 px-2 py-1 text-xs text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100">
              You are referencing: {initialReferencedItemTitle}
            </p>
          ) : null}
        </div>

        <div className="h-[420px] overflow-y-auto px-4 py-4">
          {loading ? <p className="text-sm text-sky-600">Loading messages...</p> : null}
          {!loading && messages.length === 0 ? (
            <p className="text-sm text-sky-600">No messages yet. Start the conversation.</p>
          ) : null}

          <div className="space-y-3">
            {messages.map((message) => {
              const own = message.senderId === currentUserId;
              const isSystem = message.body.startsWith("System:");
              return isSystem ? (
                <div key={message.id} className="flex justify-center">
                  <div className="max-w-[75%] rounded-xl bg-gray-200 dark:bg-gray-800 px-3 py-2 text-xs italic text-gray-700 dark:text-gray-200 text-center">
                    {message.body.replace(/^System:/, '').trim()}
                    <p className="mt-1 text-[10px] opacity-70">{new Date(message.createdAt).toLocaleTimeString()}</p>
                  </div>
                </div>
              ) : (
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
                    {message.referencedItemId ? (
                      <a
                        href={`/items/${message.referencedItemId}`}
                        className={`mt-1 inline-block rounded px-2 py-0.5 text-[11px] underline ${
                          own
                            ? "bg-white/20 text-white"
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
                        }`}
                      >
                        Referenced item: {message.referencedItemTitle || message.referencedItemId}
                      </a>
                    ) : null}
                    <p className="mt-1 text-[10px] opacity-70">
                      {new Date(message.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              );
            })}
            {typingUsers.length > 0 ? (
              <p className="text-xs text-sky-600 dark:text-sky-300">
                {typingUsers.map((u) => u.name).join(", ")} typing...
              </p>
            ) : null}
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
          <div className="mb-2 grid gap-2 sm:grid-cols-2">
            <select
              value={referencedItemId}
              onChange={(e) => setReferencedItemId(e.target.value)}
              className="rounded-md border border-sky-300 bg-white px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-sky-400 dark:border-sky-700 dark:bg-sky-950"
              disabled={!!itemId}
            >
              <option value="">No referenced item</option>
              {availableItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            {itemId ? null : (
              <button
                type="button"
                onClick={() => setReferencedItemId(itemId)}
                className="rounded-md border border-sky-300 px-3 py-2 text-xs hover:bg-sky-100 dark:border-sky-700 dark:hover:bg-sky-900"
              >
                Reference this chat item
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(e) => {
                const value = e.target.value;
                setDraft(value);

                const now = Date.now();
                if (value.trim() && now - typingPulseRef.current > 1200) {
                  typingPulseRef.current = now;
                  void sendTypingStatus(true);
                }

                if (typingStopTimerRef.current) {
                  clearTimeout(typingStopTimerRef.current);
                }
                typingStopTimerRef.current = setTimeout(() => {
                  void sendTypingStatus(false);
                }, 1800);
              }}
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
