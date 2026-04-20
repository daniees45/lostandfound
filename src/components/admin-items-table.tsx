"use client";

import { useActionState, useState } from "react";
import { adminUpdateItem, adminDeleteItem, type AdminActionState } from "@/app/actions/admin";
import { Item } from "@/lib/types";

const STATUS_OPTIONS: Item["status"][] = [
  "lost",
  "found",
  "claimed",
  "returned",
  "held_at_pickup",
];

const CATEGORY_OPTIONS = [
  "Electronics",
  "Bags",
  "Documents",
  "Clothing",
  "Others",
];

function statusColor(status: Item["status"]) {
  const map: Record<string, string> = {
    lost: "bg-rose-100 text-rose-800",
    found: "bg-emerald-100 text-emerald-800",
    claimed: "bg-blue-100 text-blue-800",
    returned: "bg-sky-100 text-sky-700",
    held_at_pickup: "bg-amber-100 text-amber-800",
  };
  return map[status] ?? "bg-sky-100 text-sky-700";
}

function EditRow({
  item,
  onCancel,
}: {
  item: Item;
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState<AdminActionState, FormData>(
    adminUpdateItem,
    undefined
  );

  return (
    <tr className="border-b border-sky-100 bg-sky-50 dark:border-sky-900 dark:bg-sky-950">
      <td colSpan={6} className="px-4 py-3">
        <form action={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <input type="hidden" name="itemId" value={item.id} />

          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium">Title</span>
            <input
              name="title"
              defaultValue={item.title}
              required
              className="rounded-md border border-sky-300 bg-white px-2 py-1.5 outline-none focus:ring-2 focus:ring-sky-400 dark:border-sky-700 dark:bg-sky-950"
            />
            {state?.errors?.title && (
              <p className="text-rose-600">{state.errors.title[0]}</p>
            )}
          </label>

          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium">Category</span>
            <select
              name="category"
              defaultValue={item.category}
              className="rounded-md border border-sky-300 bg-white px-2 py-1.5 outline-none focus:ring-2 focus:ring-sky-400 dark:border-sky-700 dark:bg-sky-950"
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium">Location</span>
            <input
              name="location"
              defaultValue={item.location}
              required
              className="rounded-md border border-sky-300 bg-white px-2 py-1.5 outline-none focus:ring-2 focus:ring-sky-400 dark:border-sky-700 dark:bg-sky-950"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium">Status</span>
            <select
              name="status"
              defaultValue={item.status}
              className="rounded-md border border-sky-300 bg-white px-2 py-1.5 outline-none focus:ring-2 focus:ring-sky-400 dark:border-sky-700 dark:bg-sky-950"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs sm:col-span-2 lg:col-span-2">
            <span className="font-medium">Description</span>
            <textarea
              name="description"
              defaultValue={item.description}
              rows={2}
              required
              className="rounded-md border border-sky-300 bg-white px-2 py-1.5 outline-none focus:ring-2 focus:ring-sky-400 dark:border-sky-700 dark:bg-sky-950"
            />
          </label>

          {state?.message && (
            <p
              className={`text-xs sm:col-span-2 lg:col-span-3 ${
                state.success ? "text-emerald-700" : "text-rose-600"
              }`}
            >
              {state.message}
            </p>
          )}

          <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
            <button
              disabled={pending}
              className="rounded-md bg-sky-600 px-3 py-1.5 text-xs text-white hover:bg-sky-700 disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-sky-300 px-3 py-1.5 text-xs hover:bg-sky-100 dark:border-sky-700 dark:hover:bg-sky-900"
            >
              Cancel
            </button>
          </div>
        </form>
      </td>
    </tr>
  );
}

function DeleteButton({ item }: { item: Item }) {
  const [state, action, pending] = useActionState<AdminActionState, FormData>(
    adminDeleteItem,
    undefined
  );
  const [confirm, setConfirm] = useState(false);

  if (confirm) {
    return (
      <form action={action} className="flex items-center gap-1">
        <input type="hidden" name="itemId" value={item.id} />
        <button
          disabled={pending}
          className="rounded-md bg-rose-600 px-2 py-1 text-[11px] text-white hover:bg-rose-700 disabled:opacity-60"
        >
          {pending ? "Deleting…" : "Confirm"}
        </button>
        <button
          type="button"
          onClick={() => setConfirm(false)}
          className="rounded-md border border-sky-300 px-2 py-1 text-[11px] hover:bg-sky-100 dark:border-sky-700 dark:hover:bg-sky-900"
        >
          Cancel
        </button>
        {state?.message && !state.success && (
          <span className="text-[11px] text-rose-600">{state.message}</span>
        )}
      </form>
    );
  }

  return (
    <button
      onClick={() => setConfirm(true)}
      className="rounded-md border border-rose-300 px-2 py-1 text-[11px] text-rose-700 hover:bg-rose-50 dark:border-rose-700 dark:text-rose-400 dark:hover:bg-rose-950"
    >
      Delete
    </button>
  );
}

export function AdminItemsTable({ items }: { items: Item[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-sky-200 bg-white p-4 text-sm text-sky-600 dark:border-sky-800 dark:bg-sky-950">
        No items in the database.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-sky-200 dark:border-sky-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-sky-200 bg-sky-50 text-left dark:border-sky-800 dark:bg-sky-950">
            <th className="px-4 py-2 font-medium">Title</th>
            <th className="px-4 py-2 font-medium">Category</th>
            <th className="px-4 py-2 font-medium">Location</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium">Date</th>
            <th className="px-4 py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) =>
            editingId === item.id ? (
              <EditRow
                key={item.id}
                item={item}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <tr
                key={item.id}
                className="border-b border-sky-100 last:border-0 hover:bg-sky-50 dark:border-sky-900 dark:hover:bg-sky-950"
              >
                <td className="px-4 py-2 font-medium">{item.title}</td>
                <td className="px-4 py-2 text-sky-700 dark:text-sky-300">{item.category}</td>
                <td className="px-4 py-2 text-sky-700 dark:text-sky-300">{item.location}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${statusColor(item.status)}`}>
                    {item.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-sky-600 dark:text-sky-400">
                  {item.created_at
                    ? new Date(item.created_at).toLocaleDateString()
                    : "—"}
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingId(item.id)}
                      className="rounded-md border border-sky-300 px-2 py-1 text-[11px] hover:bg-sky-100 dark:border-sky-700 dark:hover:bg-sky-900"
                    >
                      Edit
                    </button>
                    <DeleteButton item={item} />
                  </div>
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}
