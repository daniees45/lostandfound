import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { Item } from "@/lib/types";
import { AdminItemsTable } from "@/components/admin-items-table";
import { AdminUsersTable, AdminClaimsTable } from "@/components/admin-users-table";
import { AdminCopilot } from "@/components/admin-copilot";

type Profile = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  role: string;
  created_at?: string;
};

type Claim = {
  id: string;
  item_id: string;
  claimant_id: string;
  proof_description?: string | null;
  status: string;
  created_at?: string;
  item_title?: string;
  claimant_email?: string;
};

export default async function AdminPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login?redirectTo=/admin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/dashboard");

  // ── fetch all items ───────────────────────────────────────────────────────
  const { data: itemsData } = await supabase
    .from("items")
    .select("id, user_id, title, description, category, ai_tags, location, status, created_at, image_url")
    .order("created_at", { ascending: false })
    .limit(200);
  const items = (itemsData ?? []) as Item[];

  // ── fetch all profiles ────────────────────────────────────────────────────
  const { data: usersData } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, created_at")
    .order("created_at", { ascending: false });
  const users = (usersData ?? []) as Profile[];

  // ── fetch all claims with item titles + claimant emails ───────────────────
  const { data: claimsRaw } = await supabase
    .from("claims")
    .select("id, item_id, claimant_id, proof_description, status, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const itemTitleMap = new Map(items.map((i) => [i.id, i.title]));
  const userEmailMap = new Map(users.map((u) => [u.id, u.email ?? undefined]));

  const claims: Claim[] = (claimsRaw ?? []).map((c) => ({
    id: c.id as string,
    item_id: c.item_id as string,
    claimant_id: c.claimant_id as string,
    proof_description: c.proof_description as string | null,
    status: c.status as string,
    created_at: c.created_at as string,
    item_title: itemTitleMap.get(c.item_id as string),
    claimant_email: userEmailMap.get(c.claimant_id as string),
  }));

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-sky-500">
            Admin Panel
          </p>
          <h1 className="text-2xl font-bold">System Management</h1>
          <p className="mt-1 text-sm text-sky-700 dark:text-sky-300">
            Signed in as <strong>{profile.full_name ?? user.email}</strong>
          </p>
        </div>
        <Link
          href="/dashboard"
          className="rounded-md border border-sky-300 px-3 py-1.5 text-sm hover:bg-sky-100 dark:border-sky-700 dark:hover:bg-sky-900"
        >
          ← Dashboard
        </Link>
      </div>

      {/* Stats strip */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-sky-200 bg-white p-4 dark:border-sky-800 dark:bg-sky-950">
          <p className="text-2xl font-bold text-sky-700">{items.length}</p>
          <p className="mt-1 text-sm text-sky-600 dark:text-sky-400">Total items</p>
        </div>
        <div className="rounded-xl border border-sky-200 bg-white p-4 dark:border-sky-800 dark:bg-sky-950">
          <p className="text-2xl font-bold text-sky-700">{users.length}</p>
          <p className="mt-1 text-sm text-sky-600 dark:text-sky-400">Registered users</p>
        </div>
        <div className="rounded-xl border border-sky-200 bg-white p-4 dark:border-sky-800 dark:bg-sky-950">
          <p className="text-2xl font-bold text-sky-700">{claims.length}</p>
          <p className="mt-1 text-sm text-sky-600 dark:text-sky-400">Total claims</p>
        </div>
      </div>

      {/* AI Admin Copilot */}
      <AdminCopilot stats={{ items: items.length, users: users.length, claims: claims.length }} />

      {/* Items CRUD */}
      <section className="mb-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Items{" "}
            <span className="ml-1 rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-700 dark:bg-sky-900 dark:text-sky-300">
              {items.length}
            </span>
          </h2>
          <Link
            href="/report"
            className="rounded-md bg-sky-600 px-3 py-1.5 text-sm text-white hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-400"
          >
            + New item
          </Link>
        </div>
        <AdminItemsTable items={items} />
      </section>

      {/* Users */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold">
          Users{" "}
          <span className="ml-1 rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-700 dark:bg-sky-900 dark:text-sky-300">
            {users.length}
          </span>
        </h2>
        <p className="mb-3 text-sm text-sky-700 dark:text-sky-300">
          Change a user&apos;s role by selecting from the dropdown — it saves automatically.
        </p>
        <AdminUsersTable users={users} />
      </section>

      {/* Claims */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold">
          Claims{" "}
          <span className="ml-1 rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-700 dark:bg-sky-900 dark:text-sky-300">
            {claims.length}
          </span>
        </h2>
        <AdminClaimsTable claims={claims} />
      </section>
    </div>
  );
}
