"use client";

import { useActionState } from "react";
import Link from "next/link";
import { updatePassword, type AuthState } from "@/app/actions/auth";

export default function ResetPasswordPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    updatePassword,
    undefined
  );

  return (
    <div className="mx-auto mt-20 w-full max-w-sm px-4">
      <h1 className="text-2xl font-semibold">Set new password</h1>
      <p className="mt-1 text-sm text-sky-500">Valley View Lost &amp; Found</p>

      <form action={action} className="mt-5 space-y-4">
        <label className="block text-sm">
          <span className="mb-1 block">New password</span>
          <input
            name="password"
            type="password"
            required
            autoComplete="new-password"
            className="w-full rounded-md border border-sky-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-400 dark:border-sky-700 dark:bg-sky-950"
          />
          {state?.errors?.password ? (
            <p className="mt-1 text-xs text-rose-600">{state.errors.password[0]}</p>
          ) : null}
        </label>

        <label className="block text-sm">
          <span className="mb-1 block">Confirm new password</span>
          <input
            name="confirmPassword"
            type="password"
            required
            autoComplete="new-password"
            className="w-full rounded-md border border-sky-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-400 dark:border-sky-700 dark:bg-sky-950"
          />
          {state?.errors?.confirmPassword ? (
            <p className="mt-1 text-xs text-rose-600">
              {state.errors.confirmPassword[0]}
            </p>
          ) : null}
        </label>

        {state?.message ? (
          <p className="rounded-md bg-rose-100 px-3 py-2 text-sm text-rose-800">
            {state.message}
          </p>
        ) : null}

        <button
          disabled={pending}
          className="w-full rounded-md bg-sky-600 py-2 text-sm text-white hover:bg-sky-700 disabled:opacity-60 dark:bg-sky-500 dark:hover:bg-sky-400"
        >
          {pending ? "Updating password..." : "Update password"}
        </button>

        <p className="text-center text-sm text-sky-600 dark:text-sky-400">
          <Link
            href="/auth/login"
            className="font-medium text-zinc-900 underline dark:text-zinc-100"
          >
            Back to sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
