import Link from "next/link";
import { and, eq, gt, isNull, ne, or } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { initializeDatabase } from "@/lib/db";
import { chat_messages, chat_reads, notifications, profiles } from "@/lib/schema";
import { signOut } from "@/app/actions/auth";

const publicLinks = [
  { href: "/", label: "Home" },
  { href: "/items", label: "Browse Items" },
];

const authLinks = [
  { href: "/report", label: "Report Item" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/profile", label: "Profile" },
  { href: "/chat", label: "Chat" },
  { href: "/notifications", label: "Notifications" },
  { href: "/pickup", label: "Pickup" },
];

export async function AppNav() {
  let user = null;
  let unreadNotifications = 0;
  let unreadChat = 0;
  let userRole: string | null = null;
  let avatarUrl: string | null = null;

  try {
    user = await getCurrentUser();
    if (user) {
      const db = initializeDatabase();
      const [unreadRows, profile] = await Promise.all([
        db
          .select({ id: notifications.id })
          .from(notifications)
          .where(and(eq(notifications.user_id, user.id), eq(notifications.read, false))),
        db
          .select({ role: profiles.role, avatar_url: profiles.avatar_url })
          .from(profiles)
          .where(eq(profiles.id, user.id))
          .get(),
      ]);

      const unreadChatRows = await db
        .select({ id: chat_messages.id })
        .from(chat_messages)
        .leftJoin(
          chat_reads,
          and(eq(chat_reads.room_id, chat_messages.room_id), eq(chat_reads.user_id, user.id))
        )
        .where(
          and(
            ne(chat_messages.sender_id, user.id),
            or(isNull(chat_reads.last_read_at), gt(chat_messages.created_at, chat_reads.last_read_at))
          )
        );

      unreadNotifications = unreadRows.length;
      unreadChat = unreadChatRows.length;
      userRole = profile?.role ?? null;
      avatarUrl = profile?.avatar_url ?? null;
    }
  } catch {
    // no session or db not configured
  }

  return (
    <header className="border-b border-sky-700 bg-sky-600 shadow-sm dark:border-sky-900 dark:bg-sky-900">
      <nav className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="text-sm font-semibold tracking-wide text-white">
          VVU Lost &amp; Found
        </Link>
        <ul className="flex flex-wrap items-center gap-2 text-sm">
          {publicLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="rounded-md px-3 py-1.5 text-sky-100 hover:bg-sky-700 hover:text-white dark:hover:bg-sky-800"
              >
                {link.label}
              </Link>
            </li>
          ))}

          {user
            ? authLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="rounded-md px-3 py-1.5 text-sky-100 hover:bg-sky-700 hover:text-white dark:hover:bg-sky-800"
                  >
                    {link.label}
                    {link.href === "/chat" && unreadChat > 0 ? (
                      <span className="ml-1.5 rounded-full bg-amber-300 px-1.5 py-0.5 text-[11px] font-semibold text-sky-900">
                        {unreadChat}
                      </span>
                    ) : null}
                    {link.href === "/notifications" && unreadNotifications > 0 ? (
                      <span className="ml-1.5 rounded-full bg-white px-1.5 py-0.5 text-[11px] text-sky-700">
                        {unreadNotifications}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))
            : null}

          {user && userRole === "admin" ? (
            <li>
              <Link
                href="/admin"
                className="rounded-md bg-white/20 px-3 py-1.5 text-white hover:bg-white/30 font-medium"
              >
                Admin
              </Link>
            </li>
          ) : null}

          {user ? (
            avatarUrl ? (
              <li>
                <Link href="/profile" className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={avatarUrl}
                    alt="Profile"
                    className="h-8 w-8 rounded-full border border-white/50 object-cover"
                  />
                </Link>
              </li>
            ) : null
          ) : null}

          {user ? (
            <li>
              <form action={signOut}>
                <button className="rounded-md border border-sky-400 px-3 py-1.5 text-xs text-sky-100 hover:bg-sky-700 dark:border-sky-700 dark:hover:bg-sky-800">
                  Sign out
                </button>
              </form>
            </li>
          ) : (
            <>
              <li>
                <Link
                  href="/auth/login"
                  className="rounded-md px-3 py-1.5 text-sky-100 hover:bg-sky-700 hover:text-white dark:hover:bg-sky-800"
                >
                  Sign in
                </Link>
              </li>
              <li>
                <Link
                  href="/auth/signup"
                  className="rounded-md bg-white px-3 py-1.5 text-sky-700 font-medium hover:bg-sky-50 dark:bg-sky-100 dark:text-sky-900"
                >
                  Sign up
                </Link>
              </li>
            </>
          )}
        </ul>
      </nav>
    </header>
  );
}
