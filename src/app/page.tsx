import Link from "next/link";
import { desc, inArray } from "drizzle-orm";
import { initializeDatabase } from "@/lib/db";
import { items as itemsTable } from "@/lib/schema";
import { Item } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  lost: "Lost",
  found: "Found",
  claimed: "Claimed",
  returned: "Returned",
  held_at_pickup: "At Pickup",
};

const STATUS_COLOR: Record<string, string> = {
  lost: "bg-rose-100 text-rose-700",
  found: "bg-emerald-100 text-emerald-700",
  claimed: "bg-amber-100 text-amber-700",
  returned: "bg-sky-100 text-sky-700",
  held_at_pickup: "bg-purple-100 text-purple-700",
};

async function getRecentItems(): Promise<{ lost: Item[]; found: Item[]; now: number }> {
  try {
    const db = initializeDatabase();
    const data = await db
      .select({
        id: itemsTable.id,
        title: itemsTable.title,
        category: itemsTable.category,
        location: itemsTable.location,
        status: itemsTable.status,
        created_at: itemsTable.created_at,
        image_url: itemsTable.image_url,
        description: itemsTable.description,
      })
      .from(itemsTable)
      .where(inArray(itemsTable.status, ["lost", "found", "held_at_pickup"] as const))
      .orderBy(desc(itemsTable.created_at))
      .limit(12);

    const items = (data ?? []).map((item) => ({
      ...item,
      created_at: item.created_at?.toISOString(),
    })) as Item[];
    return {
      now: Date.now(),
      lost: items.filter((i) => i.status === "lost").slice(0, 6),
      found: items.filter((i) => i.status === "found" || i.status === "held_at_pickup").slice(0, 6),
    };
  } catch {
    return { now: Date.now(), lost: [], found: [] };
  }
}

function getTimeAgo(createdAt: string, now: number): string {
  const diff = now - new Date(createdAt).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

function ItemCard({ item, now }: { item: Item; now: number }) {
  const statusLabel = STATUS_LABEL[item.status] ?? item.status;
  const statusColor = STATUS_COLOR[item.status] ?? "bg-sky-100 text-sky-700";
  const ago = item.created_at ? getTimeAgo(item.created_at, now) : null;

  return (
    <Link
      href={`/items/${item.id}`}
      className="group flex flex-col rounded-xl border border-sky-200 bg-white p-4 transition hover:border-sky-400 hover:shadow-md dark:border-sky-800 dark:bg-sky-950 dark:hover:border-sky-500"
    >
      {item.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.image_url}
          alt={item.title}
          className="mb-3 h-32 w-full rounded-lg object-cover"
        />
      ) : (
        <div className="mb-3 flex h-32 w-full items-center justify-center rounded-lg bg-sky-100 text-3xl dark:bg-sky-900">
          {item.category === "Electronics" ? "📱" :
           item.category === "Bag" ? "🎒" :
           item.category === "Key" ? "🔑" :
           item.category === "Wallet" ? "👛" :
           item.category === "ID/Card" ? "🪪" :
           item.category === "Clothing" ? "👕" : "📦"}
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold leading-snug group-hover:text-sky-700 dark:group-hover:text-sky-300">
          {item.title}
        </h3>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${statusColor}`}>
          {statusLabel}
        </span>
      </div>
      <p className="mt-1 line-clamp-2 text-xs text-sky-600 dark:text-sky-400">
        {item.description}
      </p>
      <div className="mt-2 flex items-center justify-between text-[11px] text-sky-500">
        <span>📍 {item.location}</span>
        {ago && <span>{ago}</span>}
      </div>
    </Link>
  );
}

export default async function Home() {
  const { lost, found, now } = await getRecentItems();
  const hasItems = lost.length > 0 || found.length > 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      {/* Hero */}
      <section className="rounded-2xl border border-sky-200 bg-white p-8 shadow-sm dark:border-sky-800 dark:bg-sky-950">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-500">
          Valley View University
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Lost &amp; Found Management System
        </h1>
        <p className="mt-3 max-w-2xl text-sky-700 dark:text-sky-300">
          Lost something on campus? Found an item? Report it here and we&apos;ll help reunite it with its owner.
        </p>

        <form action="/items" className="mt-6 flex flex-col gap-2 sm:flex-row">
          <input
            name="q"
            placeholder="Search by item name, location, or category…"
            className="w-full rounded-md border border-sky-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-400 dark:border-sky-700 dark:bg-sky-950"
          />
          <button className="shrink-0 rounded-md bg-sky-600 px-5 py-2 text-sm font-medium text-white hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-400">
            Search
          </button>
        </form>

        <div className="mt-5 flex flex-wrap gap-2 text-sm">
          <Link
            href="/report"
            className="rounded-md bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-400"
          >
            + Report an item
          </Link>
          <Link
            href="/items"
            className="rounded-md border border-sky-300 px-4 py-2 hover:bg-sky-100 dark:border-sky-700 dark:hover:bg-sky-900"
          >
            Browse all items
          </Link>
          <Link
            href="/auth/login"
            className="rounded-md border border-sky-300 px-4 py-2 hover:bg-sky-100 dark:border-sky-700 dark:hover:bg-sky-900"
          >
            Sign in
          </Link>
        </div>
      </section>

      {/* Stats strip */}
      <div className="mt-6 grid grid-cols-3 gap-3 text-center">
        {[
          { label: "Open Lost Reports", value: lost.length > 0 ? `${lost.length}+` : "—" },
          { label: "Found Items", value: found.length > 0 ? `${found.length}+` : "—" },
          { label: "Quick Pickup", value: "📍 On campus" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-sky-200 bg-white px-3 py-4 dark:border-sky-800 dark:bg-sky-950"
          >
            <p className="text-xl font-bold text-sky-700">{s.value}</p>
            <p className="mt-0.5 text-xs text-sky-500">{s.label}</p>
          </div>
        ))}
      </div>

      {hasItems ? (
        <>
          {/* Lost items */}
          {lost.length > 0 && (
            <section className="mt-10">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  🔍 Recently Lost
                  <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700">
                    {lost.length}
                  </span>
                </h2>
                <Link
                  href="/items?status=lost"
                  className="text-sm text-sky-600 hover:underline dark:text-sky-400"
                >
                  See all →
                </Link>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {lost.map((item) => (
                  <ItemCard key={item.id} item={item} now={now} />
                ))}
              </div>
            </section>
          )}

          {/* Found items */}
          {found.length > 0 && (
            <section className="mt-10">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  ✅ Recently Found
                  <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                    {found.length}
                  </span>
                </h2>
                <Link
                  href="/items?status=found"
                  className="text-sm text-sky-600 hover:underline dark:text-sky-400"
                >
                  See all →
                </Link>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {found.map((item) => (
                  <ItemCard key={item.id} item={item} now={now} />
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        /* Empty state */
        <section className="mt-10 rounded-2xl border border-dashed border-sky-300 bg-white p-12 text-center dark:border-sky-700 dark:bg-sky-950">
          <p className="text-4xl">📭</p>
          <p className="mt-3 font-semibold text-sky-700 dark:text-sky-300">No active reports yet</p>
          <p className="mt-1 text-sm text-sky-500">
            Be the first to report a lost or found item on campus.
          </p>
          <Link
            href="/report"
            className="mt-4 inline-block rounded-md bg-sky-600 px-5 py-2 text-sm font-medium text-white hover:bg-sky-700"
          >
            Report an item
          </Link>
        </section>
      )}

      {/* How it works */}
      <section className="mt-12">
        <h2 className="mb-4 text-lg font-semibold">How it works</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: "📝",
              title: "1. Report",
              desc: "Submit a lost or found item with details, location, and a photo.",
            },
            {
              icon: "🔔",
              title: "2. Match & Notify",
              desc: "Potential matches are surfaced automatically. Claimants submit proof.",
            },
            {
              icon: "🤝",
              title: "3. Collect",
              desc: "Collect your item securely at an on-campus pickup point with a verification code.",
            },
          ].map((step) => (
            <article
              key={step.title}
              className="rounded-xl border border-sky-200 bg-white p-5 dark:border-sky-800 dark:bg-sky-950"
            >
              <p className="text-3xl">{step.icon}</p>
              <h3 className="mt-2 font-semibold">{step.title}</h3>
              <p className="mt-1 text-sm text-sky-700 dark:text-sky-300">{step.desc}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

