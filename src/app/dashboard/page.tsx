import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { initializeDatabase } from "@/lib/db";
import { profiles, items as itemsTable, claims as claimsTable } from "@/lib/schema";
import { Item } from "@/lib/types";
import { signOut } from "@/app/actions/auth";
import { reviewClaimAction } from "@/app/actions/claims";
import { FlashBanner } from "@/components/flash-banner";
import { eq, inArray, desc } from "drizzle-orm";

type PendingClaim = {
  id: string;
  item_id: string;
  claimant_id: string;
  proof_description?: string | null;
  created_at?: string;
  status: "pending" | "approved" | "rejected";
};

function statusBadge(status: Item["status"]) {
  const map: Record<string, string> = {
    lost: "bg-rose-100 text-rose-800",
    found: "bg-emerald-100 text-emerald-800",
    claimed: "bg-blue-100 text-blue-800",
    returned: "bg-zinc-200 text-zinc-800",
    held_at_pickup: "bg-amber-100 text-amber-800",
  };
  return map[status] ?? "bg-sky-100 text-sky-700";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    claimMessage?: string;
    claimSuccess?: string;
    reportMessage?: string;
    reportSuccess?: string;
  }>;
}) {
  const params = await searchParams;
  const claimMessage = params.claimMessage;
  const claimSuccess = params.claimSuccess === "1";
  const reportMessage = params.reportMessage;
  const reportSuccess = params.reportSuccess === "1";
  const feedbackMessage = claimMessage ?? reportMessage;
  const feedbackSuccess = claimMessage ? claimSuccess : reportSuccess;

  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/login");
  }

  const db = initializeDatabase();

  // Fetch profile to get role
  const profile = await db
    .select({ role: profiles.role, full_name: profiles.full_name })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .get();

  const role = (profile?.role as string) ?? "student";
  const fullName = profile?.full_name ?? user.email;

  // Fetch items for this user
  const myItems = await db
    .select({
      id: itemsTable.id,
      title: itemsTable.title,
      description: itemsTable.description,
      category: itemsTable.category,
      location: itemsTable.location,
      status: itemsTable.status,
      created_at: itemsTable.created_at,
    })
    .from(itemsTable)
    .where(eq(itemsTable.user_id, user.id))
    .orderBy(desc(itemsTable.created_at));

  const items = myItems.map(item => ({
    ...item,
    created_at: item.created_at?.toISOString()
  })) as Item[];

  // Admin/pickup: fetch all items
  let allItems: Item[] = [];
  if (role === "admin" || role === "pickup_point") {
    const allItemsData = await db
      .select({
        id: itemsTable.id,
        title: itemsTable.title,
        description: itemsTable.description,
        category: itemsTable.category,
        location: itemsTable.location,
        status: itemsTable.status,
        created_at: itemsTable.created_at,
      })
      .from(itemsTable)
      .orderBy(desc(itemsTable.created_at))
      .limit(50);
    allItems = allItemsData.map(item => ({
      ...item,
      created_at: item.created_at?.toISOString()
    })) as Item[];
  }

  const itemTitleById = new Map(items.map((item) => [item.id, item.title]));
  let pendingClaims: PendingClaim[] = [];
  if (items.length > 0) {
    const claims = await db
      .select({
        id: claimsTable.id,
        item_id: claimsTable.item_id,
        claimant_id: claimsTable.claimant_id,
        proof_description: claimsTable.proof_description,
        created_at: claimsTable.created_at,
        status: claimsTable.status,
      })
      .from(claimsTable)
      .where(
        inArray(
          claimsTable.item_id,
          items.map((item) => item.id)
        )
      )
      .orderBy(desc(claimsTable.created_at))
      .limit(30);

    pendingClaims = (claims
      .map(claim => ({
        ...claim,
        created_at: claim.created_at?.toISOString()
      }))
      .filter((claim) => claim.status === "pending") ?? []) as PendingClaim[];
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-sm text-sky-600 dark:text-sky-400">
            Signed in as <strong>{fullName}</strong> ·{" "}
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-800 dark:bg-sky-900 dark:text-sky-200">
              {role}
            </span>
          </p>
          <FlashBanner
            message={feedbackMessage}
            success={feedbackSuccess}
            clearKeys={["claimMessage", "claimSuccess", "reportMessage", "reportSuccess"]}
          />
        </div>
        <div className="flex gap-2">
          <Link
            href="/report"
            className="rounded-md bg-sky-600 px-3 py-1.5 text-sm text-white hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-400"
          >
            + Report item
          </Link>
          <form action={signOut}>
            <button className="rounded-md border border-sky-300 px-3 py-1.5 text-sm hover:bg-sky-100 dark:border-sky-700 dark:hover:bg-sky-900">
              Sign out
            </button>
          </form>
        </div>
      </div>

      {/* Student: my reports */}
      <section className="mt-8">
        <h2 className="mb-3 font-medium">
          {role === "student" ? "My Reports" : "All Items"}
        </h2>
        {(role === "student" ? items : allItems).length === 0 ? (
          <p className="text-sm text-sky-600 dark:text-sky-400">{" "}
            <Link href="/report" className="underline">
              Report one now.
            </Link>
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-sky-200 dark:border-sky-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sky-200 bg-sky-50 text-left dark:border-sky-800 dark:bg-sky-950">
                  <th className="px-4 py-2 font-medium">Title</th>
                  <th className="px-4 py-2 font-medium">Category</th>
                  <th className="px-4 py-2 font-medium">Location</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {(role === "student" ? items : allItems).map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-sky-100 last:border-0 hover:bg-sky-50 dark:border-sky-900 dark:hover:bg-sky-950"
                  >
                    <td className="px-4 py-2 font-medium">
                      <Link href={`/items/${item.id}`} className="hover:underline">
                        {item.title}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-sky-700 dark:text-sky-300">
                      {item.category}
                    </td>
                    <td className="px-4 py-2 text-sky-700 dark:text-sky-300">
                      {item.location}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${statusBadge(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sky-600 dark:text-sky-400">
                      {item.created_at
                        ? new Date(item.created_at).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Pickup officer quick actions */}
      {role === "pickup_point" ? (
        <section className="mt-8">
          <h2 className="mb-3 font-medium">Quick Actions</h2>
          <div className="flex gap-2">
            <Link
              href="/pickup"
              className="rounded-md border border-sky-300 px-3 py-1.5 text-sm hover:bg-sky-100 dark:border-sky-700 dark:hover:bg-sky-900"
            >
              Verify handover code
            </Link>
          </div>
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="mb-3 font-medium">Pending Claims On My Items</h2>
        {pendingClaims.length === 0 ? (
          <p className="text-sm text-sky-600 dark:text-sky-400">No pending claims right now.</p>
        ) : (
          <div className="space-y-3">
            {pendingClaims.map((claim) => (
              <article
                key={claim.id}
                className="rounded-xl border border-sky-200 bg-white p-4 dark:border-sky-800 dark:bg-sky-950"
              >
                <p className="text-sm">
                  <strong>Item:</strong> {itemTitleById.get(claim.item_id) ?? claim.item_id}
                </p>
                <p className="mt-1 text-sm text-sky-700 dark:text-sky-300">
                  <strong>Claimant:</strong> {claim.claimant_id}
                </p>
                {claim.proof_description ? (
                  <p className="mt-1 text-sm text-sky-700 dark:text-sky-300">
                    <strong>Proof:</strong> {claim.proof_description}
                  </p>
                ) : null}
                <div className="mt-3 flex gap-2">
                  <form action={reviewClaimAction}>
                    <input type="hidden" name="claimId" value={claim.id} />
                    <input type="hidden" name="decision" value="approved" />
                    <button className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs text-white">
                      Approve
                    </button>
                  </form>
                  <form action={reviewClaimAction}>
                    <input type="hidden" name="claimId" value={claim.id} />
                    <input type="hidden" name="decision" value="rejected" />
                    <button className="rounded-md bg-rose-700 px-3 py-1.5 text-xs text-white">
                      Reject
                    </button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
