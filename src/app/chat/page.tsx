import Link from "next/link";

export default function ChatPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <div className="rounded-2xl border border-sky-200 bg-white p-6 dark:border-sky-800 dark:bg-sky-950">
        <h1 className="text-2xl font-semibold">Chat</h1>
        <p className="mt-3 text-sm text-sky-700 dark:text-sky-300">
          Realtime chat is currently disabled in Turso-only mode.
        </p>
        <p className="mt-2 text-sm text-sky-700 dark:text-sky-300">
          You can still submit claims from item pages and complete verification through pickup workflows.
        </p>
        <div className="mt-5 flex gap-2">
          <Link
            href="/items"
            className="rounded-md bg-sky-600 px-4 py-2 text-sm text-white hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-400"
          >
            Browse items
          </Link>
          <Link
            href="/dashboard"
            className="rounded-md border border-sky-300 px-4 py-2 text-sm hover:bg-sky-100 dark:border-sky-700 dark:hover:bg-sky-900"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
