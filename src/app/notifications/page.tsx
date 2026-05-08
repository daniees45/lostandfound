import { redirect } from "next/navigation";
import { markAllNotificationsRead, markNotificationRead } from "@/app/actions/notifications";
import { desc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { initializeDatabase } from "@/lib/db";
import { notifications } from "@/lib/schema";

type NotificationLog = {
  id: string;
  type: "claim_submitted" | "claim_approved" | "claim_rejected" | "item_found";
  title: string;
  message: string;
  read: boolean;
  created_at: string;
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export default async function NotificationsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/login?redirectTo=/notifications");
  }

  const db = initializeDatabase();

  const rows = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      title: notifications.title,
      message: notifications.message,
      read: notifications.read,
      created_at: notifications.created_at,
    })
    .from(notifications)
    .where(eq(notifications.user_id, user.id))
    .orderBy(desc(notifications.created_at))
    .limit(100);

  const allNotifications = (rows ?? []).map((item) => ({
    ...item,
    created_at: item.created_at?.toISOString() ?? new Date().toISOString(),
  })) as NotificationLog[];
  const unreadCount = allNotifications.filter((item) => !item.read).length;

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

      {allNotifications.length === 0 ? (
        <p className="rounded-xl border border-sky-200 bg-white p-4 text-sm text-sky-600 dark:border-sky-800 dark:bg-sky-950">
          No notifications yet.
        </p>
      ) : (
        <div className="space-y-3">
          {allNotifications.map((item) => (
            <article
              key={item.id}
              className={`rounded-xl border bg-white p-4 dark:bg-sky-950 ${
                item.read ? "border-sky-200 dark:border-sky-800" : "border-sky-500 dark:border-sky-400"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="rounded-full bg-sky-100 px-2 py-1 uppercase tracking-wide text-sky-800 dark:bg-sky-900 dark:text-sky-200">
                    {item.type.replaceAll("_", " ")}
                  </span>
                  {!item.read ? (
                    <span className="rounded-full bg-sky-100 px-2 py-1 text-sky-800">Unread</span>
                  ) : null}
                </div>
                <p className="text-xs text-sky-600 dark:text-sky-400">{formatDate(item.created_at)}</p>
              </div>

              <p className="mt-3 text-sm font-medium text-sky-800 dark:text-sky-100">{item.title}</p>
              <p className="mt-3 text-sm text-sky-800 dark:text-sky-200">{item.message}</p>

              {!item.read ? (
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