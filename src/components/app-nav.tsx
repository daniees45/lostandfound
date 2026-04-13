import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { signOut } from "@/app/actions/auth";

const publicLinks = [
  { href: "/", label: "Home" },
  { href: "/items", label: "Browse Items" },
];

const authLinks = [
  { href: "/report", label: "Report Item" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/items?chatMessage=Open+chat+from+an+item+card&chatSuccess=1", label: "Chat" },
  { href: "/notifications", label: "Notifications" },
  { href: "/pickup", label: "Pickup" },
];

export async function AppNav() {
  let user = null;
  let unreadNotifications = 0;

  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const supabase = await createSupabaseServerClient();
      const { data } = await supabase.auth.getUser();
      user = data.user;

      if (user) {
        const { count } = await supabase
          .from("notification_logs")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("is_read", false);
        unreadNotifications = count ?? 0;
      }
    } catch {
      // not yet configured
    }
  }

  return (
    <header className="border-b border-black/10 bg-white/80 backdrop-blur dark:border-white/10 dark:bg-black/70">
      <nav className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="text-sm font-semibold tracking-wide">
          VVU Lost &amp; Found
        </Link>
        <ul className="flex flex-wrap items-center gap-2 text-sm">
          {publicLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="rounded-md px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/10"
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
                    className="rounded-md px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    {link.label}
                    {link.href === "/notifications" && unreadNotifications > 0 ? (
                      <span className="ml-1.5 rounded-full bg-blue-600 px-1.5 py-0.5 text-[11px] text-white">
                        {unreadNotifications}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))
            : null}

          {user ? (
            <li>
              <form action={signOut}>
                <button className="rounded-md border border-black/15 px-3 py-1.5 text-xs hover:bg-zinc-100 dark:border-white/20 dark:hover:bg-zinc-800">
                  Sign out
                </button>
              </form>
            </li>
          ) : (
            <>
              <li>
                <Link
                  href="/auth/login"
                  className="rounded-md px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/10"
                >
                  Sign in
                </Link>
              </li>
              <li>
                <Link
                  href="/auth/signup"
                  className="rounded-md bg-black px-3 py-1.5 text-white dark:bg-white dark:text-black"
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
