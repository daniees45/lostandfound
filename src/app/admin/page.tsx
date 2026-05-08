import { redirect } from "next/navigation";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { initializeDatabase } from "@/lib/db";
import { claims as claimsTable, items as itemsTable, profiles } from "@/lib/schema";
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
  const user = await getCurrentUser();

  if (!user) redirect("/auth/login?redirectTo=/admin");

  const db = initializeDatabase();

  const profile = await db
    .select({ role: profiles.role, full_name: profiles.full_name })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .get();

  if (profile?.role !== "admin") redirect("/dashboard");

  const [itemsData, usersData, claimsRaw] = await Promise.all([
    db
      .select({
        id: itemsTable.id,
        user_id: itemsTable.user_id,
        title: itemsTable.title,
        description: itemsTable.description,
        category: itemsTable.category,
        ai_tags: itemsTable.ai_tags,
        location: itemsTable.location,
        status: itemsTable.status,
        created_at: itemsTable.created_at,
        image_url: itemsTable.image_url,
      })
      .from(itemsTable)
      .orderBy(desc(itemsTable.created_at))
      .limit(200),
    db
      .select({
        id: profiles.id,
        full_name: profiles.full_name,
        email: profiles.email,
        role: profiles.role,
        created_at: profiles.created_at,
      })
      .from(profiles)
      .orderBy(desc(profiles.created_at)),
    db
      .select({
        id: claimsTable.id,
        item_id: claimsTable.item_id,
        claimant_id: claimsTable.claimant_id,
        proof_description: claimsTable.proof_description,
        status: claimsTable.status,
        created_at: claimsTable.created_at,
      })
      .from(claimsTable)
      .orderBy(desc(claimsTable.created_at))
      .limit(200),
  ]);

  const items = (itemsData ?? []).map((item) => ({
    ...item,
    created_at: item.created_at?.toISOString(),
  })) as Item[];
  const users = (usersData ?? []).map((profileRow) => ({
    ...profileRow,
    role: profileRow.role ?? "student",
    created_at: profileRow.created_at?.toISOString(),
  })) as Profile[];

  const itemTitleMap = new Map(items.map((i) => [i.id, i.title]));
  const userEmailMap = new Map(users.map((u) => [u.id, u.email ?? undefined]));

  const claims: Claim[] = (claimsRaw ?? []).map((c) => ({
    id: c.id,
    item_id: c.item_id,
    claimant_id: c.claimant_id,
    proof_description: c.proof_description,
    status: c.status,
    created_at: c.created_at?.toISOString(),
    item_title: itemTitleMap.get(c.item_id),
    claimant_email: userEmailMap.get(c.claimant_id),
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
