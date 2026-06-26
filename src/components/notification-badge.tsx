"use client";

import { useEffect, useState } from "react";

export function NotificationBadge({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    let mounted = true;

    async function fetchUnreadCount() {
      try {
        const res = await fetch("/api/notifications/unread-count");
        if (!res.ok) return;
        const data = await res.json();
        if (mounted && typeof data.count === "number") {
          setCount(data.count);
        }
      } catch (err) {
        // silently fail on polling
      }
    }

    // Poll every 15 seconds
    const intervalId = setInterval(fetchUnreadCount, 15000);
    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, []);

  if (count === 0) return null;

  return (
    <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[11px] font-bold text-white shadow-sm ring-1 ring-rose-600 animate-in fade-in zoom-in duration-300">
      {count}
    </span>
  );
}
