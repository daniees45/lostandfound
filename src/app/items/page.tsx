import { createSupabaseServerClient } from "@/lib/supabase-server";
import { generateEmbedding, toPgVectorLiteral } from "@/lib/embeddings";
import { mockItems } from "@/lib/mock-data";
import { Item } from "@/lib/types";
import Link from "next/link";
import { submitClaimAction } from "@/app/actions/claims";
import { FlashBanner } from "@/components/flash-banner";

function formatDate(value?: string) {
  if (!value) return "Unknown";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

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

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    claimMessage?: string;
    claimSuccess?: string;
    chatMessage?: string;
    chatSuccess?: string;
    reportMessage?: string;
    reportSuccess?: string;
  }>;
}) {
  const params = await searchParams;
  const query = params.q?.toLowerCase().trim() ?? "";
  const claimMessage = params.claimMessage;
  const claimSuccess = params.claimSuccess === "1";
  const chatMessage = params.chatMessage;
  const chatSuccess = params.chatSuccess === "1";
  const reportMessage = params.reportMessage;
  const reportSuccess = params.reportSuccess === "1";
  const feedbackMessage = claimMessage ?? chatMessage ?? reportMessage;
  const feedbackSuccess = claimMessage
    ? claimSuccess
    : chatMessage
      ? chatSuccess
      : reportSuccess;
  let currentUserId: string | null = null;
  const claimStatusByItem = new Map<string, "pending" | "approved" | "rejected">();

  function mergeUniqueById(primary: Item[], secondary: Item[]) {
    const seen = new Set<string>();
    const merged: Item[] = [];

    for (const item of [...primary, ...secondary]) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      merged.push(item);
    }

    return merged;
  }

  // Try live DB; fall back to mock data when Supabase is not yet configured
  let items: Item[] = [];
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (supabaseUrl) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    currentUserId = user?.id ?? null;

    if (query) {
      const queryEmbedding = await generateEmbedding(query);

      if (queryEmbedding) {
        const { data: semanticData } = await supabase.rpc("match_items", {
          query_embedding: toPgVectorLiteral(queryEmbedding),
          match_count: 50,
        });

        items = ((semanticData as Item[] | null) ?? []).filter((item) =>
          ["found", "held_at_pickup", "claimed"].includes(item.status)
        );
      }

      if (items.length === 0) {
        const { data: fallbackData } = await supabase
          .from("items")
          .select("id, user_id, title, description, category, ai_tags, location, status, created_at, image_url")
          .in("status", ["found", "held_at_pickup", "claimed"])
          .or(
            `title.ilike.%${query}%,description.ilike.%${query}%,category.ilike.%${query}%,location.ilike.%${query}%`
          )
          .order("created_at", { ascending: false });

        items = (fallbackData as Item[]) ?? [];
      }

      if (currentUserId) {
        const { data: ownData } = await supabase
          .from("items")
          .select("id, user_id, title, description, category, ai_tags, location, status, created_at, image_url")
          .eq("user_id", currentUserId)
          .or(
            `title.ilike.%${query}%,description.ilike.%${query}%,category.ilike.%${query}%,location.ilike.%${query}%`
          )
          .order("created_at", { ascending: false })
          .limit(50);

        items = mergeUniqueById((ownData as Item[]) ?? [], items);
      }
    } else {
      const { data: publicData } = await supabase
        .from("items")
        .select("id, user_id, title, description, category, ai_tags, location, status, created_at, image_url")
        .in("status", ["found", "held_at_pickup", "claimed"])
        .order("created_at", { ascending: false });

      items = (publicData as Item[]) ?? [];

      if (currentUserId) {
        const { data: ownData } = await supabase
          .from("items")
          .select("id, user_id, title, description, category, ai_tags, location, status, created_at, image_url")
          .eq("user_id", currentUserId)
          .order("created_at", { ascending: false })
          .limit(50);

        items = mergeUniqueById((ownData as Item[]) ?? [], items);
      }
    }

    if (currentUserId && items.length > 0) {
      const { data: myClaims } = await supabase
        .from("claims")
        .select("item_id, status")
        .eq("claimant_id", currentUserId)
        .in(
          "item_id",
          items.map((item) => item.id)
        );

      for (const claim of myClaims ?? []) {
        claimStatusByItem.set(
          claim.item_id as string,
          claim.status as "pending" | "approved" | "rejected"
        );
      }
    }
  } else {
    items = mockItems.filter((item) => {
      if (!query) return true;
      const haystack = `${item.title} ${item.description} ${item.category} ${item.location}`.toLowerCase();
      return haystack.includes(query);
    });
  }

  const foundItems = items.filter((item) =>
    ["found", "held_at_pickup", "claimed", "returned"].includes(item.status)
  );
  const lostItems = items.filter((item) => item.status === "lost");

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Browse Items</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Items are grouped into Found and Lost categories.
          </p>
          <FlashBanner
            message={feedbackMessage}
            success={feedbackSuccess}
            clearKeys={[
              "claimMessage",
              "claimSuccess",
              "chatMessage",
              "chatSuccess",
              "reportMessage",
              "reportSuccess",
            ]}
          />
        </div>
        <form action="/items" className="flex gap-2">
          <input
            name="q"
            defaultValue={query}
            placeholder="Search by item, location, category"
            className="w-72 rounded-md border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/20 dark:border-white/20 dark:bg-black"
          />
          <button className="rounded-md bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black">
            Search
          </button>
        </form>
      </div>

      {foundItems.length > 0 ? (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Found Items ({foundItems.length})</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {foundItems.map((item) => (
              <article
                key={item.id}
                className="rounded-xl border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-950"
              >
                {item.image_url ? (
                  <Link href={`/items/${item.id}`} className="mb-3 block overflow-hidden rounded-lg">
                    <img
                      src={item.image_url}
                      alt={item.title}
                      className="h-44 w-full object-cover transition-transform duration-200 hover:scale-[1.02]"
                    />
                  </Link>
                ) : null}
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h2 className="font-medium">
                    <Link href={`/items/${item.id}`} className="hover:underline">
                      {item.title}
                    </Link>
                  </h2>
                  <span className={`rounded-full px-2 py-1 text-xs ${badgeClass(item.status)}`}>
                    {item.status}
                  </span>
                </div>
                <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-300">{item.description}</p>
                <dl className="space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                  <div>
                    <dt className="inline font-medium">Category:</dt> <dd className="inline">{item.category}</dd>
                  </div>
                  {item.ai_tags && item.ai_tags.length > 0 ? (
                    <div>
                      <dt className="inline font-medium">AI Tags:</dt>{" "}
                      <dd className="inline">{item.ai_tags.join(", ")}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="inline font-medium">Location:</dt> <dd className="inline">{item.location}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium">Date:</dt> <dd className="inline">{formatDate(item.created_at)}</dd>
                  </div>
                </dl>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/items/${item.id}`}
                    className="inline-block rounded-md border border-black/15 px-3 py-1.5 text-xs hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
                  >
                    View details
                  </Link>
                  <Link
                    href={`/chat?itemId=${item.id}`}
                    className="inline-block rounded-md border border-black/15 px-3 py-1.5 text-xs hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
                  >
                    Open chat
                  </Link>
                </div>

                <div className="mt-2 text-xs">
                  {!currentUserId ? (
                    <p className="text-zinc-500">Sign in to submit a claim.</p>
                  ) : item.user_id === currentUserId ? (
                    <p className="text-zinc-500">You reported this item.</p>
                  ) : claimStatusByItem.get(item.id) ? (
                    <p className="text-zinc-600 dark:text-zinc-300">
                      Claim status: <strong>{claimStatusByItem.get(item.id)}</strong>
                    </p>
                  ) : (
                    <form action={submitClaimAction} className="mt-1 space-y-2">
                      <input type="hidden" name="itemId" value={item.id} />
                      <textarea
                        name="proofDescription"
                        rows={2}
                        placeholder="Optional: add identifying details"
                        className="w-full rounded-md border border-black/15 bg-white px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-black/20 dark:border-white/20 dark:bg-black"
                      />
                      <button className="rounded-md bg-black px-3 py-1.5 text-xs text-white dark:bg-white dark:text-black">
                        Submit claim
                      </button>
                    </form>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {lostItems.length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Lost Items ({lostItems.length})</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lostItems.map((item) => (
              <article
                key={item.id}
                className="rounded-xl border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-950"
              >
                {item.image_url ? (
                  <Link href={`/items/${item.id}`} className="mb-3 block overflow-hidden rounded-lg">
                    <img
                      src={item.image_url}
                      alt={item.title}
                      className="h-44 w-full object-cover transition-transform duration-200 hover:scale-[1.02]"
                    />
                  </Link>
                ) : null}
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h2 className="font-medium">
                    <Link href={`/items/${item.id}`} className="hover:underline">
                      {item.title}
                    </Link>
                  </h2>
                  <span className={`rounded-full px-2 py-1 text-xs ${badgeClass(item.status)}`}>
                    {item.status}
                  </span>
                </div>
                <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-300">{item.description}</p>
                <dl className="space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                  <div>
                    <dt className="inline font-medium">Category:</dt> <dd className="inline">{item.category}</dd>
                  </div>
                  {item.ai_tags && item.ai_tags.length > 0 ? (
                    <div>
                      <dt className="inline font-medium">AI Tags:</dt>{" "}
                      <dd className="inline">{item.ai_tags.join(", ")}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="inline font-medium">Location:</dt> <dd className="inline">{item.location}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium">Date:</dt> <dd className="inline">{formatDate(item.created_at)}</dd>
                  </div>
                </dl>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/items/${item.id}`}
                    className="inline-block rounded-md border border-black/15 px-3 py-1.5 text-xs hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
                  >
                    View details
                  </Link>
                {currentUserId && item.user_id === currentUserId ? (
                    <Link
                      href={`/chat?itemId=${item.id}`}
                      className="inline-block rounded-md border border-black/15 px-3 py-1.5 text-xs hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
                    >
                      Open chat
                    </Link>
                ) : null}
                </div>
                <div className="mt-2 text-xs text-zinc-500">
                  {item.user_id === currentUserId
                    ? "This is your lost report."
                    : "Lost reports are visible based on access rules."}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {items.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-300">No items match your search.</p>
      ) : null}
    </div>
  );
}
