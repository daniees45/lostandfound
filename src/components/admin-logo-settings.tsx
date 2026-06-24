"use client";

import { useActionState, useState } from "react";
import { adminUpdateLogo, type AdminActionState } from "@/app/actions/admin";
import { DEFAULT_SITE_LOGO_URL } from "@/lib/app-settings";

type AdminLogoSettingsProps = {
  currentLogoUrl: string;
};

export function AdminLogoSettings({ currentLogoUrl }: AdminLogoSettingsProps) {
  const [state, action, pending] = useActionState<AdminActionState, FormData>(
    adminUpdateLogo,
    undefined
  );
  const [resetToDefault, setResetToDefault] = useState(false);

  return (
    <section className="mb-10 rounded-xl border border-sky-200 bg-white p-5 dark:border-sky-800 dark:bg-sky-950">
      <h2 className="text-lg font-semibold">Branding</h2>
      <p className="mt-1 text-sm text-sky-700 dark:text-sky-300">
        Upload a new site logo used in the top navigation across the app.
      </p>

      <div className="mt-4 flex flex-wrap items-start gap-4">
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 dark:border-sky-800 dark:bg-sky-900/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentLogoUrl}
            alt="Current site logo"
            className="h-16 w-16 rounded-md bg-white object-contain p-1"
          />
        </div>
        <div className="text-sm text-sky-700 dark:text-sky-300">
          <p>Current source: {currentLogoUrl}</p>
          <p className="text-xs text-sky-600 dark:text-sky-400">
            Default logo path: {DEFAULT_SITE_LOGO_URL}
          </p>
        </div>
      </div>

      <form action={action} className="mt-4 space-y-3" encType="multipart/form-data">
        <label className="block text-sm">
          <span className="mb-1 block">New logo image</span>
          <input
            name="logo"
            type="file"
            accept="image/*"
            disabled={resetToDefault || pending}
            className="w-full rounded-md border border-sky-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-400 disabled:opacity-60 dark:border-sky-700 dark:bg-sky-950"
          />
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={resetToDefault}
            onChange={(event) => setResetToDefault(event.target.checked)}
            disabled={pending}
          />
          Reset to default logo
        </label>

        {resetToDefault ? <input type="hidden" name="resetToDefault" value="1" /> : null}

        {state?.message ? (
          <p
            className={`rounded-md px-3 py-2 text-sm ${
              state.success ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
            }`}
          >
            {state.message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-sky-600 px-4 py-2 text-sm text-white hover:bg-sky-700 disabled:opacity-60"
        >
          {pending ? "Saving..." : "Save logo"}
        </button>
      </form>
    </section>
  );
}
