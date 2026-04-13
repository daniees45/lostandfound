import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { Item } from "@/lib/types";
import { signOut } from "@/app/actions/auth";
import { reviewClaimAction } from "@/app/actions/claims";
import { FlashBanner } from "@/components/flash-banner";

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
  return map[status] ?? "bg-zinc-100 text-zinc-700";
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

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Fetch profile to get role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  const role = (profile?.role as string) ?? "student";
  const fullName = profile?.full_name ?? user.email;

  // Fetch items for this user
  const { data: myItems } = await supabase
    .from("items")
    .select("id, title, description, category, location, status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const items = (myItems ?? []) as Item[];

  // Admin/pickup: fetch all items
  let allItems: Item[] = [];
  if (role === "admin" || role === "pickup_point") {
    const { data } = await supabase
      .from("items")
      .select("id, title, description, category, location, status, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    allItems = (data ?? []) as Item[];
  }

  const itemTitleById = new Map(items.map((item) => [item.id, item.title]));
  let pendingClaims: PendingClaim[] = [];
  if (items.length > 0) {
    const { data } = await supabase
      .from("claims")
      .select("id, item_id, claimant_id, proof_description, created_at, status")
      .in(
        "item_id",
        items.map((item) => item.id)
      )
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(30);

    pendingClaims = (data ?? []) as PendingClaim[];
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Signed in as <strong>{fullName}</strong> ·{" "}
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800">
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
            className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black"
          >
            + Report item
          </Link>
          <form action={signOut}>
            <button className="rounded-md border border-black/15 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-white/20 dark:hover:bg-zinc-800">
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
          <p className="text-sm text-zinc-500">
            No items yet.{" "}
            <Link href="/report" className="underline">
              Report one now.
            </Link>
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/10 bg-zinc-50 text-left dark:border-white/10 dark:bg-zinc-900">
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
                    className="border-b border-black/5 last:border-0 hover:bg-zinc-50 dark:border-white/5 dark:hover:bg-zinc-900"
                  >
                    <td className="px-4 py-2 font-medium">{item.title}</td>
                    <td className="px-4 py-2 text-zinc-600 dark:text-zinc-300">
                      {item.category}
                    </td>
                    <td className="px-4 py-2 text-zinc-600 dark:text-zinc-300">
                      {item.location}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${statusBadge(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-zinc-500">
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
              className="rounded-md border border-black/15 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-white/20 dark:hover:bg-zinc-800"
            >
              Verify handover code
            </Link>
          </div>
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="mb-3 font-medium">Pending Claims On My Items</h2>
        {pendingClaims.length === 0 ? (
          <p className="text-sm text-zinc-500">No pending claims right now.</p>
        ) : (
          <div className="space-y-3">
            {pendingClaims.map((claim) => (
              <article
                key={claim.id}
                className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-950"
              >
                <p className="text-sm">
                  <strong>Item:</strong> {itemTitleById.get(claim.item_id) ?? claim.item_id}
                </p>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                  <strong>Claimant:</strong> {claim.claimant_id}
                </p>
                {claim.proof_description ? (
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
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
