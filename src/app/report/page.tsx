"use client";

import { useActionState, useRef, useState } from "react";
import { createItem, type ReportState } from "@/app/actions/items";

export default function ReportPage() {
  const [state, action, pending] = useActionState<ReportState, FormData>(
    createItem,
    undefined
  );
  const [isFound, setIsFound] = useState(false);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const [aiTags, setAiTags] = useState("");

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
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
        Submitting this form saves the report directly to the database.
      </p>

      <form
        action={action}
        className="mt-6 space-y-4 rounded-xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-zinc-950"
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

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block">Item title</span>
            <input
              name="title"
              required
              className="w-full rounded-md border border-black/15 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-black/20 dark:border-white/20 dark:bg-black"
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
              className="w-full rounded-md border border-black/15 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-black/20 dark:border-white/20 dark:bg-black"
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
            className="w-full rounded-md border border-black/15 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-black/20 dark:border-white/20 dark:bg-black"
          />
          {state?.errors?.description ? (
            <p className="mt-1 text-xs text-rose-600">
              {state.errors.description[0]}
            </p>
          ) : null}
        </label>

        <div className="rounded-md border border-dashed border-black/20 p-3 text-xs dark:border-white/25">
          <p className="font-medium">AI auto-tag preview</p>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
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
              className="w-full rounded-md border border-black/15 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-black/20 dark:border-white/20 dark:bg-black"
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
              className="w-full rounded-md border border-black/15 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-black/20 dark:border-white/20 dark:bg-black"
            />
          </label>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block">Image (optional)</span>
          <input
            name="image"
            type="file"
            accept="image/*"
            className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm outline-none file:mr-3 file:rounded-md file:border-0 file:bg-black file:px-3 file:py-1.5 file:text-white focus:ring-2 focus:ring-black/20 dark:border-white/20 dark:bg-black dark:file:bg-white dark:file:text-black"
          />
          <p className="mt-1 text-xs text-zinc-500">Attach a clear photo of the item. Maximum size: 5MB.</p>
        </label>

        <label className="flex items-start gap-2 rounded-md bg-zinc-100 p-3 text-xs dark:bg-zinc-900">
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
          className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {pending ? "Submitting…" : "Submit report"}
        </button>
      </form>
    </div>
  );
}
