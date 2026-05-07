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
  let userRole: string | null = null;

  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const supabase = await createSupabaseServerClient();
      const { data } = await supabase.auth.getUser();
      user = data.user;

      if (user) {
        const [{ count }, { data: profile }] = await Promise.all([
          supabase
            .from("notification_logs")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("is_read", false),
          supabase.from("profiles").select("role").eq("id", user.id).single(),
        ]);

        unreadNotifications = count ?? 0;
        userRole = (profile?.role as string) ?? null;
      }
    } catch {
      // not yet configured
    }
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
