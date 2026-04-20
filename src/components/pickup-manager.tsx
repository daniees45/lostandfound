"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { releaseHeldItem, type PickupState, verifyPickupCode } from "@/app/actions/pickup";

type HeldPickupItem = {
  id: string;
  title: string;
  location: string;
  created_at?: string;
  approvedClaim:
    | {
        claimantId: string;
        claimantName: string;
        claimantEmail: string;
        proofDescription?: string | null;
      }
    | null;
};

function ReleaseCard({ item }: { item: HeldPickupItem }) {
  const [state, formAction, pending] = useActionState<PickupState, FormData>(
    releaseHeldItem,
    undefined
  );
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      router.refresh();
    }
  }, [router, state?.success]);

  return (
    <article className="rounded-xl border border-sky-200 bg-white p-4 dark:border-sky-800 dark:bg-sky-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-medium">{item.title}</h3>
          <p className="mt-1 text-sm text-sky-700 dark:text-sky-300">Location: {item.location}</p>
          <p className="mt-1 text-xs text-sky-600 dark:text-sky-400">
            Held since {item.created_at ? new Date(item.created_at).toLocaleDateString() : "unknown date"}
          </p>
        </div>
        <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-800">held_at_pickup</span>
      </div>

      {item.approvedClaim ? (
        <>
          <div className="mt-4 rounded-lg bg-sky-50 p-3 text-sm dark:bg-sky-900">
            <p>
              <strong>Approved claimant:</strong> {item.approvedClaim.claimantName}
            </p>
            <p className="mt-1 text-sky-700 dark:text-sky-300">{item.approvedClaim.claimantEmail}</p>
            {item.approvedClaim.proofDescription ? (
              <p className="mt-1 text-sky-700 dark:text-sky-300">
                <strong>Claim proof:</strong> {item.approvedClaim.proofDescription}
              </p>
            ) : null}
          </div>

          <form action={formAction} className="mt-4 space-y-3">
            <input type="hidden" name="itemId" value={item.id} />
            <input type="hidden" name="claimantId" value={item.approvedClaim.claimantId} />

            <label className="block text-sm">
              <span className="mb-1 block">Verification method</span>
              <select
                name="verificationMethod"
                defaultValue="id_card"
                className="w-full rounded-md border border-sky-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-400 dark:border-sky-700 dark:bg-sky-950"
              >
                <option value="id_card">Student ID checked</option>
                <option value="manual_override">Manual override</option>
              </select>
              {state?.errors?.verificationMethod?.[0] ? (
                <p className="mt-1 text-xs text-rose-600">{state.errors.verificationMethod[0]}</p>
              ) : null}
            </label>

            <label className="block text-sm">
              <span className="mb-1 block">Release notes</span>
              <textarea
                name="notes"
                rows={3}
                placeholder="Optional notes about identity confirmation or handoff context"
                className="w-full rounded-md border border-sky-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-400 dark:border-sky-700 dark:bg-sky-950"
              />
              {state?.errors?.notes?.[0] ? (
                <p className="mt-1 text-xs text-rose-600">{state.errors.notes[0]}</p>
              ) : null}
            </label>

            <button
              disabled={pending}
              className="rounded-md bg-emerald-700 px-4 py-2 text-sm text-white disabled:opacity-60"
            >
              {pending ? "Releasing..." : "Release to claimant"}
            </button>

            {state?.message ? (
              <p
                className={`text-sm ${
                  state.success
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-rose-700 dark:text-rose-400"
                }`}
              >
                {state.message}
              </p>
            ) : null}
          </form>
        </>
      ) : (
        <p className="mt-4 text-sm text-sky-600 dark:text-sky-400">
          No approved claimant is attached yet. Approve a claim before final release.
        </p>
      )}
    </article>
  );
}

export function PickupManager({ heldItems }: { heldItems: HeldPickupItem[] }) {
  const [handoverCode, setHandoverCode] = useState("");
  const [verifyState, verifyAction, verifyPending] = useActionState<PickupState, FormData>(
    verifyPickupCode,
    undefined
  );
  const router = useRouter();

  useEffect(() => {
    if (verifyState?.success) {
      startTransition(() => {
        setHandoverCode("");
      });
      router.refresh();
    }
  }, [router, verifyState?.success]);

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-sky-200 bg-white p-5 dark:border-sky-800 dark:bg-sky-950">
        <h2 className="text-lg font-medium">Receive item into pickup custody</h2>
          <p className="mt-2 text-sm text-sky-700 dark:text-sky-300">
          Verify the finder handover code to move an item into pickup custody.
        </p>

        <form action={verifyAction} className="mt-5 space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block">Handover code</span>
            <input
              name="handoverCode"
              inputMode="numeric"
              maxLength={6}
              value={handoverCode}
              onChange={(event) => setHandoverCode(event.target.value.replace(/\D/g, ""))}
              placeholder="e.g. 483921"
              className="w-full rounded-md border border-sky-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-400 dark:border-sky-700 dark:bg-sky-950"
            />
            {verifyState?.errors?.handoverCode?.[0] ? (
              <p className="mt-1 text-xs text-rose-600">{verifyState.errors.handoverCode[0]}</p>
            ) : null}
          </label>

            <div className="grid gap-2 text-xs text-sky-700 dark:text-sky-300">
            <p>1. Finder drops item and provides generated code.</p>
            <p>2. Officer verifies code and marks status as held_at_pickup.</p>
            <p>3. Approved claimant presents ID for final release.</p>
          </div>

          <button
            disabled={verifyPending}
            className="rounded-md bg-sky-600 px-4 py-2 text-sm text-white hover:bg-sky-700 disabled:opacity-60 dark:bg-sky-500 dark:hover:bg-sky-400"
          >
            {verifyPending ? "Verifying..." : "Verify code"}
          </button>

          {verifyState?.message ? (
            <p
              className={`text-sm ${
                verifyState.success
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-rose-700 dark:text-rose-400"
              }`}
            >
              {verifyState.message}
            </p>
          ) : null}
        </form>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-medium">Held items awaiting release</h2>
          <p className="mt-1 text-sm text-sky-700 dark:text-sky-300">
            Release items only after confirming the approved claimant identity.
          </p>
        </div>

        {heldItems.length === 0 ? (
          <p className="rounded-xl border border-sky-200 bg-white p-4 text-sm text-sky-600 dark:border-sky-800 dark:bg-sky-950">
            No items are currently held at pickup.
          </p>
        ) : (
          <div className="space-y-4">
            {heldItems.map((item) => (
              <ReleaseCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}