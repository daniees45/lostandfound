"use client";

import { useActionState, useRef, useState, useEffect } from "react";
import Link from "next/link";
import { createItem, checkForSimilarItems, type ReportState } from "@/app/actions/items";

export default function ReportPage() {
  const [state, action, pending] = useActionState<ReportState, FormData>(
    createItem,
    undefined
  );
  const [isFound, setIsFound] = useState(false);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const [aiTags, setAiTags] = useState("");
  const [title, setTitle] = useState("");
  const [similarItems, setSimilarItems] = useState<
    Array<{ id: string; title: string; category: string; location: string; status: string }>
  >([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced duplicate check whenever title changes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (title.trim().length < 4) {
      setSimilarItems([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setCheckingDuplicates(true);
      try {
        const results = await checkForSimilarItems({
          title,
          description: descRef.current?.value ?? "",
          status: isFound ? "found" : "lost",
        });
        setSimilarItems(results);
      } finally {
        setCheckingDuplicates(false);
      }
    }, 700);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [title, isFound]);

  function handleDescriptionChange(value: string) {
    const tags: string[] = [];
    if (/blue/i.test(value)) tags.push("Blue");
    if (/black/i.test(value)) tags.push("Black");
    if (/white/i.test(value)) tags.push("White");
    if (/phone|iphone|android/i.test(value)) tags.push("Phone");
    if (/bag|backpack|purse/i.test(value)) tags.push("Bag");
    if (/wallet/i.test(value)) tags.push("Wallet");
    if (/laptop|macbook|dell|hp/i.test(value)) tags.push("Laptop");
    setAiTags(tags.join(", "));
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Report Lost or Found Item</h1>
          <p className="mt-2 text-sm text-sky-700 dark:text-sky-300">
        Submitting this form saves the report directly to the database.
      </p>

      <form
        action={action}
        className="mt-6 space-y-4 rounded-xl border border-sky-200 bg-white p-5 dark:border-sky-800 dark:bg-sky-950"
      >
        {/* hidden isFoundItem flag submitted as string */}
        <input type="hidden" name="isFoundItem" value={String(isFound)} />

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isFound}
            onChange={(e) => setIsFound(e.target.checked)}
          />
          This is a found-item report
        </label>

        {/* Duplicate / smart-match warning */}
        {checkingDuplicates ? (
          <p className="text-xs text-sky-500">Checking for similar reports…</p>
        ) : similarItems.length > 0 ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs dark:border-amber-700 dark:bg-amber-950">
            <p className="font-semibold text-amber-800 dark:text-amber-300">
              ⚠ {similarItems.length} similar {isFound ? "lost" : "found"} report{similarItems.length > 1 ? "s" : ""} already exist. Check before submitting:
            </p>
            <ul className="mt-1 space-y-0.5">
              {similarItems.map((it) => (
                <li key={it.id}>
                  <Link
                    href={`/items/${it.id}`}
                    target="_blank"
                    className="text-amber-700 underline dark:text-amber-400"
                  >
                    {it.title} — {it.location}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block">Item title</span>
            <input
              name="title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-sky-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-400 dark:border-sky-700 dark:bg-sky-950"
            />
            {state?.errors?.title ? (
              <p className="mt-1 text-xs text-rose-600">{state.errors.title[0]}</p>
            ) : null}
          </label>

          <label className="text-sm">
            <span className="mb-1 block">Category</span>
            <select
              name="category"
              defaultValue="Electronics"
              className="w-full rounded-md border border-sky-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-400 dark:border-sky-700 dark:bg-sky-950"
            >
              <option>Electronics</option>
              <option>Bags</option>
              <option>Documents</option>
              <option>Clothing</option>
              <option>Others</option>
            </select>
          </label>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block">Description</span>
          <textarea
            ref={descRef}
            name="description"
            rows={4}
            required
            onChange={(e) => handleDescriptionChange(e.target.value)}
            placeholder="Include identifiable details: color, brand, unique marks"
            className="w-full rounded-md border border-sky-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-400 dark:border-sky-700 dark:bg-sky-950"
          />
          {state?.errors?.description ? (
            <p className="mt-1 text-xs text-rose-600">
              {state.errors.description[0]}
            </p>
          ) : null}
        </label>

        <div className="rounded-md border border-dashed border-sky-300 p-3 text-xs dark:border-sky-700">
          <p className="font-medium">AI auto-tag preview</p>
          <p className="mt-1 text-sky-700 dark:text-sky-400">
            {aiTags
              ? `Suggested tags: ${aiTags}`
              : "Start typing a description to generate tags."}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block">Location</span>
            <input
              name="location"
              required
              className="w-full rounded-md border border-sky-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-400 dark:border-sky-700 dark:bg-sky-950"
            />
            {state?.errors?.location ? (
              <p className="mt-1 text-xs text-rose-600">
                {state.errors.location[0]}
              </p>
            ) : null}
          </label>
          <label className="text-sm">
            <span className="mb-1 block">Date</span>
            <input
              name="date"
              type="date"
              required
              className="w-full rounded-md border border-sky-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-400 dark:border-sky-700 dark:bg-sky-950"
            />
          </label>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block">Image (optional)</span>
          <input
            name="image"
            type="file"
            accept="image/*"
            className="w-full rounded-md border border-sky-300 bg-white px-3 py-2 text-sm outline-none file:mr-3 file:rounded-md file:border-0 file:bg-sky-600 file:px-3 file:py-1.5 file:text-white hover:file:bg-sky-700 focus:ring-2 focus:ring-sky-400 dark:border-sky-700 dark:bg-sky-950 dark:file:bg-sky-500"
          />
          <p className="mt-1 text-xs text-sky-600 dark:text-sky-400">Attach a clear photo of the item. Maximum size: 5MB.</p>
        </label>

        <label className="flex items-start gap-2 rounded-md bg-sky-100 p-3 text-xs dark:bg-sky-900">
          <input type="checkbox" required className="mt-0.5" />
          <span>
            I agree to the rules of conduct and privacy disclaimer. I understand
            abusive behavior or false claims may lead to account restriction.
          </span>
        </label>

        {state?.message ? (
          <p className="rounded-md bg-rose-100 px-3 py-2 text-sm text-rose-800">
            {state.message}
          </p>
        ) : null}

        <button
          disabled={pending}
          className="rounded-md bg-sky-600 px-4 py-2 text-sm text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-sky-500 dark:hover:bg-sky-400"
        >
          {pending ? "Submitting…" : "Submit report"}
        </button>
      </form>
    </div>
  );
}
