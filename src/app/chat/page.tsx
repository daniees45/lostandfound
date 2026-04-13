"use client";

import { FormEvent, Suspense, startTransition, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

const CHAT_RULES_ACCEPTED_KEY_PREFIX = "lostfound_chat_rules_accepted_item_";

type Message = {
  id: string;
  sender_id: string;
  sender_role: "finder" | "claimer";
  body: string;
  created_at: string;
};

function ChatContent() {
  const [accepted, setAccepted] = useState(false);
  const [acceptanceLoaded, setAcceptanceLoaded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [senderRole, setSenderRole] = useState<"finder" | "claimer">("claimer");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [itemTitle, setItemTitle] = useState<string>("Item chat");
  const [loading, setLoading] = useState(true);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [chatInfo, setChatInfo] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const itemId = searchParams.get("itemId");
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  useEffect(() => {
    const storageKey = itemId
      ? `${CHAT_RULES_ACCEPTED_KEY_PREFIX}${itemId}`
      : `${CHAT_RULES_ACCEPTED_KEY_PREFIX}unknown`;

    const savedAcceptance = window.localStorage.getItem(storageKey);
    startTransition(() => {
      setAccepted(savedAcceptance === "1");
      setAcceptanceLoaded(true);
    });
  }, [itemId]);

  useEffect(() => {
    let isMounted = true;

    async function bootstrapChat() {
      setLoading(true);
      setMessageError(null);
      setChatInfo(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (isMounted) {
          setMessageError("You must be signed in to use chat.");
          setLoading(false);
        }
        return;
      }

      if (!itemId) {
        router.replace("/items?chatMessage=Open+chat+from+an+item+card&chatSuccess=1");
        return;
      }

      if (isMounted) {
        setCurrentUserId(user.id);
      }

      const { data: itemRow, error: itemError } = await supabase
        .from("items")
        .select("id, title, user_id")
        .eq("id", itemId)
        .maybeSingle();

      if (itemError) {
        if (isMounted) {
          setMessageError(itemError.message);
          setLoading(false);
        }
        return;
      }

      if (!itemRow) {
        if (isMounted) {
          setMessageError("Item not found.");
          setLoading(false);
        }
        return;
      }

      const isFinder = itemRow.user_id === user.id;
      if (isMounted) {
        setItemTitle(itemRow.title);
        setSenderRole(isFinder ? "finder" : "claimer");
      }

      if (!isFinder) {
        const { data: claimRow, error: claimError } = await supabase
          .from("claims")
          .select("id")
          .eq("item_id", itemRow.id)
          .eq("claimant_id", user.id)
          .in("status", ["pending", "approved"])
          .maybeSingle();

        if (claimError) {
          if (isMounted) {
            setMessageError(claimError.message);
            setLoading(false);
          }
          return;
        }

        if (!claimRow) {
          if (isMounted) {
            setMessageError("You can only chat after submitting a claim for this item.");
            setLoading(false);
          }
          return;
        }
      }

      let resolvedSessionId: string | null = null;

      if (isFinder) {
        const { data: finderSessions, error: finderSessionError } = await supabase
          .from("chat_sessions")
          .select("id, claimer_id")
          .eq("item_id", itemRow.id)
          .order("created_at", { ascending: false })
          .limit(1);

        if (finderSessionError) {
          if (isMounted) {
            setMessageError(finderSessionError.message);
            setLoading(false);
          }
          return;
        }

        resolvedSessionId = finderSessions?.[0]?.id ?? null;

        if (!resolvedSessionId) {
          const sessionCode = `item-${itemRow.id}-owner`;
          const { data: insertedOwnerSession, error: createOwnerSessionError } = await supabase
            .from("chat_sessions")
            .insert({
              item_id: itemRow.id,
              finder_id: user.id,
              claimer_id: null,
              session_code: sessionCode,
              created_by: user.id,
            })
            .select("id")
            .single();

          if (createOwnerSessionError) {
            if (isMounted) {
              setMessageError(createOwnerSessionError.message);
              setLoading(false);
            }
            return;
          }

          resolvedSessionId = insertedOwnerSession.id;
        }

        if (isMounted && finderSessions?.[0]?.claimer_id == null) {
          setChatInfo("No claimant joined yet. You can send a message now; it will be visible when a claimant joins.");
        }
      } else {
        const { data: existingSession, error: sessionReadError } = await supabase
          .from("chat_sessions")
          .select("id")
          .eq("item_id", itemRow.id)
          .eq("claimer_id", user.id)
          .maybeSingle();

        if (sessionReadError) {
          if (isMounted) {
            setMessageError(sessionReadError.message);
            setLoading(false);
          }
          return;
        }

        resolvedSessionId = existingSession?.id ?? null;

        if (!resolvedSessionId) {
          const { data: openSession, error: openSessionReadError } = await supabase
            .from("chat_sessions")
            .select("id")
            .eq("item_id", itemRow.id)
            .is("claimer_id", null)
            .maybeSingle();

          if (openSessionReadError) {
            if (isMounted) {
              setMessageError(openSessionReadError.message);
              setLoading(false);
            }
            return;
          }

          if (openSession) {
            const { data: claimedSession, error: claimSessionError } = await supabase
              .from("chat_sessions")
              .update({ claimer_id: user.id })
              .eq("id", openSession.id)
              .is("claimer_id", null)
              .select("id")
              .maybeSingle();

            if (claimSessionError) {
              if (isMounted) {
                setMessageError(claimSessionError.message);
                setLoading(false);
              }
              return;
            }

            resolvedSessionId = claimedSession?.id ?? openSession.id;
          }
        }

        if (!resolvedSessionId) {
          const sessionCode = `item-${itemRow.id}-${user.id.slice(0, 8)}`;
          const { data: insertedSession, error: createSessionError } = await supabase
            .from("chat_sessions")
            .insert({
              item_id: itemRow.id,
              finder_id: itemRow.user_id,
              claimer_id: user.id,
              session_code: sessionCode,
              created_by: user.id,
            })
            .select("id")
            .single();

          if (createSessionError) {
            if (isMounted) {
              setMessageError(createSessionError.message);
              setLoading(false);
            }
            return;
          }

          resolvedSessionId = insertedSession.id;
        }
      }

      const { data: existingMessages, error: readMessagesError } = await supabase
        .from("messages")
        .select("id, sender_id, sender_role, body, created_at")
        .eq("session_id", resolvedSessionId)
        .order("created_at", { ascending: true })
        .limit(100);

      if (readMessagesError) {
        if (isMounted) {
          setMessageError(readMessagesError.message);
          setLoading(false);
        }
        return;
      }

      if (isMounted) {
        setSessionId(resolvedSessionId);
        setMessages((existingMessages ?? []) as Message[]);
        setLoading(false);
      }
    }

    bootstrapChat();

    return () => {
      isMounted = false;
    };
  }, [itemId, router, supabase]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    async function loadLatestMessages() {
      const { data, error } = await supabase
        .from("messages")
        .select("id, sender_id, sender_role, body, created_at")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true })
        .limit(100);

      if (error) {
        return;
      }

      setMessages((previous) => {
        const next = (data ?? []) as Message[];
        if (
          previous.length === next.length &&
          previous.every((message, index) => message.id === next[index]?.id)
        ) {
          return previous;
        }
        return next;
      });
    }

    const channel = supabase
      .channel(`messages-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const nextMessage = payload.new as Message;
          setMessages((previous) => {
            if (previous.some((message) => message.id === nextMessage.id)) {
              return previous;
            }
            return [...previous, nextMessage];
          });
        }
      )
      .subscribe();

    const intervalId = window.setInterval(loadLatestMessages, 2500);

    return () => {
      window.clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, [sessionId, supabase]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim() || !accepted || !sessionId || !currentUserId || isSending) return;

    const text = draft.trim();
    setIsSending(true);
    setDraft("");

    const { error } = await supabase.from("messages").insert({
      session_id: sessionId,
      sender_id: currentUserId,
      sender_role: senderRole,
      body: text,
    });

    if (error) {
      setMessageError(error.message);
      setDraft(text);
    }

    setIsSending(false);
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Finder ↔ Claimer Chat</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
        Anonymized communication preview with a mandatory privacy gate.
      </p>

      <p className="mt-1 text-xs text-zinc-500">Item: {itemTitle}</p>

      {messageError ? (
        <p className="mt-3 text-sm text-rose-700 dark:text-rose-400">{messageError}</p>
      ) : null}

      {chatInfo ? (
        <p className="mt-3 text-sm text-amber-800 dark:text-amber-300">{chatInfo}</p>
      ) : null}

      {!acceptanceLoaded ? (
        <section className="mt-5 rounded-xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-zinc-950">
          <p className="text-sm text-zinc-500">Loading chat preferences...</p>
        </section>
      ) : !accepted ? (
        <section className="mt-5 rounded-xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-zinc-950">
          <h2 className="font-medium">Rules of Conduct & Privacy</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-600 dark:text-zinc-300">
            <li>Respectful communication only.</li>
            <li>Do not share bank details or OTPs.</li>
            <li>Meet in designated pickup points for safety.</li>
            <li>Contact details remain hidden unless both parties agree.</li>
          </ul>
          <button
            className="mt-4 rounded-md bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black"
            onClick={() => {
              const storageKey = itemId
                ? `${CHAT_RULES_ACCEPTED_KEY_PREFIX}${itemId}`
                : `${CHAT_RULES_ACCEPTED_KEY_PREFIX}unknown`;
              window.localStorage.setItem(storageKey, "1");
              setAccepted(true);
            }}
          >
            I agree, continue to chat
          </button>
        </section>
      ) : (
        <section className="mt-5 rounded-xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-zinc-950">
          <p className="rounded-md bg-amber-100 px-3 py-2 text-xs text-amber-900">
            Safety Notice: Meet at an approved pickup point. Do not share sensitive personal or financial details.
          </p>

          <div className="mt-4 space-y-3">
            {loading ? (
              <p className="text-sm text-zinc-500">Loading chat...</p>
            ) : !sessionId ? (
              <p className="text-sm text-zinc-500">Waiting for a claimant to start a conversation.</p>
            ) : messages.length === 0 ? (
              <p className="text-sm text-zinc-500">No messages yet. Start the conversation.</p>
            ) : null}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`max-w-[88%] rounded-lg px-3 py-2 text-sm ${
                  message.sender_id === currentUserId
                    ? "ml-auto bg-black text-white dark:bg-white dark:text-black"
                    : "bg-zinc-100 dark:bg-zinc-800"
                }`}
              >
                <p className="mb-1 text-[11px] uppercase opacity-70">{message.sender_role}</p>
                <p className="whitespace-pre-wrap break-words">{message.body}</p>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSend} className="mt-4 flex gap-2">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={!sessionId}
              placeholder="Type a message"
              rows={2}
              className="w-full resize-y rounded-md border border-black/15 bg-white px-3 py-2 text-sm leading-6 outline-none focus:ring-2 focus:ring-black/20 dark:border-white/20 dark:bg-black"
            />
            <button
              disabled={!sessionId || isSending}
              className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-60 dark:bg-white dark:text-black"
            >
              {!sessionId ? "Waiting" : isSending ? "Sending" : "Send"}
            </button>
          </form>
        </section>
      )}
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-3xl px-4 py-8">
          <h1 className="text-2xl font-semibold">Finder ↔ Claimer Chat</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">Loading chat...</p>
        </div>
      }
    >
      <ChatContent />
    </Suspense>
  );
}
