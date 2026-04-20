import { redirect } from "next/navigation";
import { markAllNotificationsRead, markNotificationRead } from "@/app/actions/notifications";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type NotificationLog = {
  id: string;
  channel: "email" | "sms_dummy";
  message: string;
  status: "queued" | "sent" | "failed";
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export default async function NotificationsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?redirectTo=/notifications");
  }

  const { data: rows } = await supabase
    .from("notification_logs")
    .select("id, channel, message, status, is_read, read_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const notifications = (rows ?? []) as NotificationLog[];
  const unreadCount = notifications.filter((item) => !item.is_read).length;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Notifications</h1>
          <p className="mt-1 text-sm text-sky-700 dark:text-sky-300">
            Status updates and delivery logs for your lost &amp; found activity.
          </p>
        </div>
        <form action={markAllNotificationsRead}>
          <button
            disabled={unreadCount === 0}
            className="rounded-md border border-sky-300 px-3 py-2 text-sm disabled:opacity-60 dark:border-sky-700"
          >
            Mark all read ({unreadCount})
          </button>
        </form>
      </div>

      {notifications.length === 0 ? (
        <p className="rounded-xl border border-sky-200 bg-white p-4 text-sm text-sky-600 dark:border-sky-800 dark:bg-sky-950">
          No notifications yet.
        </p>
      ) : (
        <div className="space-y-3">
          {notifications.map((item) => (
            <article
              key={item.id}
              className={`rounded-xl border bg-white p-4 dark:bg-sky-950 ${
                item.is_read ? "border-sky-200 dark:border-sky-800" : "border-sky-500 dark:border-sky-400"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="rounded-full bg-sky-100 px-2 py-1 uppercase tracking-wide text-sky-800 dark:bg-sky-900 dark:text-sky-200">
                    {item.channel}
                  </span>
                  <span
                    className={`rounded-full px-2 py-1 uppercase tracking-wide ${
                      item.status === "sent"
                        ? "bg-emerald-100 text-emerald-800"
                        : item.status === "failed"
                          ? "bg-rose-100 text-rose-800"
                          : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {item.status}
                  </span>
                  {!item.is_read ? (
                    <span className="rounded-full bg-sky-100 px-2 py-1 text-sky-800">Unread</span>
                  ) : null}
                </div>
                <p className="text-xs text-sky-600 dark:text-sky-400">{formatDate(item.created_at)}</p>
              </div>

              <p className="mt-3 text-sm text-sky-800 dark:text-sky-200">{item.message}</p>

              {!item.is_read ? (
                <form action={markNotificationRead} className="mt-3">
                  <input type="hidden" name="notificationId" value={item.id} />
                  <button className="rounded-md border border-sky-300 px-3 py-1.5 text-xs hover:bg-sky-100 dark:border-sky-700 dark:hover:bg-sky-900">
                    Mark as read
                  </button>
                </form>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}