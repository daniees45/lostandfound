"use client";

import { useState } from "react";
import ClientEditItemModal from "@/components/ClientEditItemModal";
import { Item } from "@/lib/types";
import { submitClaimAction } from "@/app/actions/claims";
import Link from "next/link";

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
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export default function ItemDetailClient({ 
  item, 
  currentUserId 
}: { 
  item: Item, 
  currentUserId?: string 
}) {
  const [editOpen, setEditOpen] = useState(false);
  const isOwner = currentUserId === item.user_id;
  const canClaim = !isOwner && ["found", "held_at_pickup"].includes(item.status);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <Link 
          href="/items"
          className="text-sm text-sky-600 hover:underline dark:text-sky-400"
        >
          ← Back to Browse
        </Link>
        {isOwner && (
          <button 
            onClick={() => setEditOpen(true)}
            className="rounded-md bg-sky-600 px-4 py-2 text-sm text-white hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-400"
          >
            Edit Item
          </button>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Left column: Image */}
        <div>
          {item.image_url ? (
            <div className="overflow-hidden rounded-2xl border border-sky-200 shadow-sm dark:border-sky-800">
              <img 
                src={item.image_url} 
                alt={item.title} 
                className="w-full object-cover"
              />
            </div>
          ) : (
            <div className="flex aspect-video w-full items-center justify-center rounded-2xl border-2 border-dashed border-sky-200 bg-sky-50 text-sky-400 dark:border-sky-800 dark:bg-sky-950">
              No image provided
            </div>
          )}
        </div>

        {/* Right column: Details */}
        <div className="space-y-6">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <h1 className="text-3xl font-bold">{item.title}</h1>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${badgeClass(item.status)}`}>
                {item.status.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="text-lg text-sky-700 dark:text-sky-300">{item.category}</p>
          </div>

          <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-4 dark:border-sky-900 dark:bg-sky-950/50">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">Description</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{item.description}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-sky-500">Location</h3>
              <p className="text-sm">{item.location}</p>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-sky-500">Date Reported</h3>
              <p className="text-sm">{formatDate(item.created_at)}</p>
            </div>
          </div>

          {item.ai_tags && item.ai_tags.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-sky-500">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {item.ai_tags.map(tag => (
                  <span key={tag} className="rounded-md bg-sky-100 px-2 py-1 text-xs text-sky-700 dark:bg-sky-900 dark:text-sky-300">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          <hr className="border-sky-100 dark:border-sky-900" />

          {/* Action Area */}
          <div className="space-y-4">
            {isOwner ? (
              <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400">
                You reported this item. You can manage claims from your dashboard.
              </div>
            ) : canClaim ? (
              <div className="rounded-xl border border-sky-200 p-6 dark:border-sky-800">
                <h3 className="mb-4 font-semibold">Is this your item?</h3>
                {!currentUserId ? (
                  <Link 
                    href="/auth/login"
                    className="block w-full rounded-md bg-sky-600 py-2 text-center text-sm font-medium text-white hover:bg-sky-700"
                  >
                    Sign in to submit a claim
                  </Link>
                ) : (
                  <form action={submitClaimAction} className="space-y-4">
                    <input type="hidden" name="itemId" value={item.id} />
                    <div>
                      <label className="mb-2 block text-sm text-sky-700 dark:text-sky-300">
                        Proof of ownership
                      </label>
                      <textarea
                        name="proofDescription"
                        rows={3}
                        required
                        placeholder="Please provide details that only the owner would know (e.g., serial number, specific contents, unique scratches)."
                        className="w-full rounded-md border border-sky-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-400 dark:border-sky-700 dark:bg-sky-950"
                      />
                    </div>
                    <button className="w-full rounded-md bg-sky-600 py-2 text-sm font-medium text-white hover:bg-sky-700">
                      Submit Claim
                    </button>
                  </form>
                )}
              </div>
            ) : item.status === "claimed" || item.status === "returned" ? (
              <div className="rounded-lg bg-sky-50 p-4 text-sm text-sky-800 dark:bg-sky-950/30 dark:text-sky-400">
                This item has already been successfully claimed or returned.
              </div>
            ) : null}

            <Link
              href={`/chat?itemId=${item.id}`}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-sky-300 py-2 text-sm font-medium hover:bg-sky-100 dark:border-sky-700 dark:hover:bg-sky-900"
            >
              Open Chat with Owner
            </Link>
          </div>
        </div>
      </div>

      {editOpen && (
        <ClientEditItemModal
          item={item}
          isOpen={editOpen}
          onClose={() => setEditOpen(false)}
          onSuccess={() => alert("Item updated successfully!")}
        />
      )}
    </div>
  );
}