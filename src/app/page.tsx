import Link from "next/link";

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <section className="rounded-2xl border border-sky-200 bg-white p-8 shadow-sm dark:border-sky-800 dark:bg-sky-950">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-500">
          Valley View University
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Lost and Found Management System
        </h1>
        <p className="mt-3 max-w-3xl text-sky-700 dark:text-sky-300">
          A web platform for reporting, tracking, matching, and safely handing over lost items with privacy-first communication and pickup-point workflows.
        </p>

        <form action="/items" className="mt-6 flex flex-col gap-2 sm:flex-row">
          <input
            name="q"
            placeholder="Search by item, location, category"
            className="w-full rounded-md border border-sky-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-400 dark:border-sky-700 dark:bg-sky-950"
          />
          <button className="rounded-md bg-sky-600 px-4 py-2 text-sm text-white hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-400">
            Find item
          </button>
        </form>

        <div className="mt-6 flex flex-wrap gap-2 text-sm">
          <Link href="/report" className="rounded-md bg-sky-600 px-4 py-2 text-white hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-400">
            Report lost/found item
          </Link>
          <Link
            href="/dashboard"
            className="rounded-md border border-sky-300 px-4 py-2 hover:bg-sky-100 dark:border-sky-700 dark:hover:bg-sky-900"
          >
            Open dashboard
          </Link>
          <Link
            href="/pickup"
            className="rounded-md border border-sky-300 px-4 py-2 hover:bg-sky-100 dark:border-sky-700 dark:hover:bg-sky-900"
          >
            Pickup handover
          </Link>
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <article className="rounded-xl border border-sky-200 bg-white p-4 dark:border-sky-800 dark:bg-sky-950">
          <h2 className="font-semibold">Privacy Gate</h2>
          <p className="mt-1 text-sm text-sky-700 dark:text-sky-300">
            Users accept rules of conduct before starting chat.
          </p>
        </article>
        <article className="rounded-xl border border-sky-200 bg-white p-4 dark:border-sky-800 dark:bg-sky-950">
          <h2 className="font-semibold">Pickup Point Role</h2>
          <p className="mt-1 text-sm text-sky-700 dark:text-sky-300">
            Officers can log walk-in items and verify handovers by code.
          </p>
        </article>
        <article className="rounded-xl border border-sky-200 bg-white p-4 dark:border-sky-800 dark:bg-sky-950">
          <h2 className="font-semibold">AI-Ready Search</h2>
          <p className="mt-1 text-sm text-sky-700 dark:text-sky-300">
            Structured for semantic matching and auto-tagging in later iterations.
          </p>
        </article>
      </section>
    </div>
  );
}

