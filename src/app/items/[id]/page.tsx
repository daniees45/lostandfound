import Link from "next/link";
import { useState } from "react";
import { notFound, redirect } from "next/navigation";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { submitClaimAction } from "@/app/actions/claims";
import { getCurrentUser } from "@/lib/auth";
import { initializeDatabase } from "@/lib/db";
import { claims as claimsTable, items as itemsTable } from "@/lib/schema";
import { Item } from "@/lib/types";
import ClientEditItemModal from "@/components/ClientEditItemModal";

const EditItemModal = ClientEditItemModal;

function badgeClass(status: Item["status"]) {
  switch (status) {
    case "found":
      return "bg-emerald-100 text-emerald-800";
    case "held_at_pickup":
      return "bg-amber-100 text-amber-800";
    case "claimed":
      return "bg-blue-100 text-blue-800";
    case "returned":
      return "bg-zinc-200 text-zinc-800";
    default:
      return "bg-rose-100 text-rose-800";
  }
}

function formatDate(value?: string) {
  if (!value) return "Unknown";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // Modal state for client
  const [editOpen, setEditOpen] = useState(false);
  const { id } = await params;
  const user = await getCurrentUser();
  const db = initializeDatabase();

  const itemRow = await db
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
    .where(eq(itemsTable.id, id))
    .get();

  if (!itemRow) {
    notFound();
  }

  const item = {
    ...itemRow,
    created_at: itemRow.created_at?.toISOString(),
  } as Item;
  const currentUserId = user?.id ?? null;
  const isOwner = currentUserId === item.user_id;

  let claimStatus: "pending" | "approved" | "rejected" | null = null;
  if (currentUserId && !isOwner) {
    const myClaim = await db
      .select({ status: claimsTable.status })
      .from(claimsTable)
      .where(and(eq(claimsTable.item_id, item.id), eq(claimsTable.claimant_id, currentUserId)))
      .orderBy(desc(claimsTable.created_at))
      .limit(1)
      .get();

    claimStatus = myClaim?.status ?? null;
  }

  let approvedClaimInfo: { claimantId: string; proofDescription?: string | null } | null = null;
  if (isOwner || currentUserId) {
    const approvedClaim = await db
      .select({
        claimant_id: claimsTable.claimant_id,
        proof_description: claimsTable.proof_description,
      })
      .from(claimsTable)
      .where(and(eq(claimsTable.item_id, item.id), eq(claimsTable.status, "approved")))
      .get();

    if (approvedClaim) {
      approvedClaimInfo = {
        claimantId: approvedClaim.claimant_id,
        proofDescription: approvedClaim.proof_description ?? null,
      };
    }
  }

  // ── Smart matches: fetch opposite-type items in same category ────────────
  const oppositeStatuses =
    item.status === "lost" ? ["found", "held_at_pickup"] : ["lost"];
  const matchData = await db
    .select({
      id: itemsTable.id,
      title: itemsTable.title,
      category: itemsTable.category,
      location: itemsTable.location,
      status: itemsTable.status,
      created_at: itemsTable.created_at,
    })
    .from(itemsTable)
    .where(
      and(
        inArray(itemsTable.status, oppositeStatuses as ["lost"] | ["found", "held_at_pickup"]),
        eq(itemsTable.category, item.category),
        ne(itemsTable.id, item.id)
      )
    )
    .orderBy(desc(itemsTable.created_at))
    .limit(3);
  const possibleMatches = (matchData ?? []).map((m) => ({
    ...m,
    created_at: m.created_at?.toISOString() ?? new Date().toISOString(),
  })) as Array<{
    id: string;
    title: string;
    category: string;
    location: string;
    status: string;
    created_at: string;
  }>;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      {isOwner && (
        <>
          <button
            className="mb-4 rounded bg-sky-600 text-white px-4 py-2 hover:bg-sky-700"
            onClick={() => setEditOpen(true)}
          >
            Edit Item
          </button>
          <EditItemModal
            item={item}
            isOpen={editOpen}
            onClose={() => setEditOpen(false)}
            onSuccess={() => window.location.reload()}
          />
        </>
      )}
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-sky-600 dark:text-sky-400">
        <Link href="/items" className="hover:underline">
          Browse items
        </Link>
        <span>/</span>
        <span>{item.title}</span>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <section>
          <div className="overflow-hidden rounded-2xl border border-sky-200 bg-white dark:border-sky-800 dark:bg-sky-950">
            {item.image_url ? (
              <img src={item.image_url} alt={item.title} className="h-[340px] w-full object-cover" />
            ) : (
              <div className="flex h-[340px] items-center justify-center bg-sky-100 text-sm text-sky-500 dark:bg-sky-900">
                No image uploaded for this item.
              </div>
            )}

            <div className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-3xl font-semibold">{item.title}</h1>
                  <p className="mt-2 text-sm text-sky-700 dark:text-sky-300">{item.description}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs ${badgeClass(item.status)}`}>
                  {item.status}
                </span>
              </div>

              <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-sky-500">Category</dt>
                  <dd className="mt-1 text-sm">{item.category}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-sky-500">Location</dt>
                  <dd className="mt-1 text-sm">{item.location}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-sky-500">Reported on</dt>
                  <dd className="mt-1 text-sm">{formatDate(item.created_at)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-sky-500">AI tags</dt>
                  <dd className="mt-1 text-sm">{item.ai_tags?.length ? item.ai_tags.join(", ") : "No AI tags"}</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-sky-200 bg-white p-5 dark:border-sky-800 dark:bg-sky-950">
            <h2 className="text-lg font-medium">Actions</h2>
            <div className="mt-4 space-y-3">
              <Link
                href={`/chat?itemId=${item.id}`}
                className="block rounded-md border border-sky-300 px-3 py-2 text-center text-sm hover:bg-sky-100 dark:border-sky-700 dark:hover:bg-sky-900"
              >
                Open chat
              </Link>
              <Link
                href={`/chat?itemId=${item.id}&refItemId=${item.id}`}
                className="block rounded-md border border-emerald-300 px-3 py-2 text-center text-sm text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950"
              >
                Reference this item in chat
              </Link>

              {!currentUserId ? (
                <button
                  onClick={async () => {
                    "use server";
                    redirect(`/auth/login?redirectTo=${encodeURIComponent(`/items/${item.id}`)}`);
                  }}
                  className="hidden"
                />
              ) : null}

              {!currentUserId ? (
                <p className="text-sm text-sky-600 dark:text-sky-400">Sign in to submit a claim or join chat.</p>
              ) : isOwner ? (
                <p className="text-sm text-sky-600 dark:text-sky-400">You reported this item.</p>
              ) : claimStatus ? (
                <p className="text-sm text-sky-700 dark:text-sky-300">
                  Your claim status: <strong>{claimStatus}</strong>
                </p>
              ) : ["found", "held_at_pickup", "claimed"].includes(item.status) ? (
                <form action={submitClaimAction} className="space-y-2">
                  <input type="hidden" name="itemId" value={item.id} />
                  <textarea
                    name="proofDescription"
                    rows={3}
                    placeholder="Optional: add identifying details"
                    className="w-full rounded-md border border-sky-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-400 dark:border-sky-700 dark:bg-sky-950"
                  />
                  <button className="w-full rounded-md bg-sky-600 px-4 py-2 text-sm text-white hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-400">
                    Submit claim
                  </button>
                </form>
              ) : (
                <p className="text-sm text-sky-600 dark:text-sky-400">This item is not currently open for claims.</p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-sky-200 bg-white p-5 dark:border-sky-800 dark:bg-sky-950">
            <h2 className="text-lg font-medium">Status timeline</h2>
            <div className="mt-4 space-y-3 text-sm text-sky-700 dark:text-sky-300">
              <p>
                <strong>Reported:</strong> {formatDate(item.created_at)}
              </p>
              <p>
                <strong>Current status:</strong> {item.status}
              </p>
              {item.status === "held_at_pickup" ? (
                <p>The item is currently with pickup staff awaiting verified release.</p>
              ) : null}
              {item.status === "returned" ? (
                <p>The item has been returned and the custody flow is complete.</p>
              ) : null}
              {approvedClaimInfo ? (
                <p>
                  <strong>Approved claim:</strong> An approved claimant is attached to this item.
                </p>
              ) : null}
            </div>
          </section>

          {/* Smart matches: opposite-type items in same category */}
          {possibleMatches.length > 0 ? (
            <section className="rounded-2xl border border-emerald-200 bg-white p-5 dark:border-emerald-800 dark:bg-sky-950">
              <h2 className="text-lg font-medium text-emerald-700 dark:text-emerald-400">
                Possible Matches
              </h2>
              <p className="mt-1 text-xs text-sky-600 dark:text-sky-400">
                {item.status === "lost"
                  ? "These found items in the same category may be yours."
                  : "Someone may have reported this item as lost."}
              </p>
              <ul className="mt-3 space-y-2">
                {possibleMatches.map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`/items/${m.id}`}
                      className="block rounded-md border border-emerald-100 p-2.5 text-sm hover:bg-emerald-50 dark:border-emerald-900 dark:hover:bg-emerald-950"
                    >
                      <p className="font-medium">{m.title}</p>
                      <p className="mt-0.5 text-xs text-sky-600 dark:text-sky-400">
                        {m.location} &middot; {formatDate(m.created_at)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}