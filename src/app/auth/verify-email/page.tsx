"use client";

import { Suspense, useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  resendVerificationEmail,
  type AuthState,
} from "@/app/actions/auth";

function VerifyEmailContent() {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    resendVerificationEmail,
    undefined
  );
  const params = useSearchParams();
  const message = params.get("message");
  const success = params.get("success") === "1";

  return (
    <div className="mx-auto mt-20 w-full max-w-sm px-4">
      <h1 className="text-2xl font-semibold">Verify your email</h1>
      <p className="mt-1 text-sm text-sky-500">Valley View Lost &amp; Found</p>

      {message ? (
        <p
          className={`mt-4 rounded-md px-3 py-2 text-sm ${
            success
              ? "bg-emerald-100 text-emerald-800"
              : "bg-rose-100 text-rose-800"
          }`}
        >
          {message}
        </p>
      ) : null}

      <form action={action} className="mt-5 space-y-4">
        <label className="block text-sm">
          <span className="mb-1 block">Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full rounded-md border border-sky-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-400 dark:border-sky-700 dark:bg-sky-950"
          />
          {state?.errors?.email ? (
            <p className="mt-1 text-xs text-rose-600">{state.errors.email[0]}</p>
          ) : null}
        </label>

        {state?.message ? (
          <p className="rounded-md bg-emerald-100 px-3 py-2 text-sm text-emerald-800">
            {state.message}
          </p>
        ) : null}

        <button
          disabled={pending}
          className="w-full rounded-md bg-sky-600 py-2 text-sm text-white hover:bg-sky-700 disabled:opacity-60 dark:bg-sky-500 dark:hover:bg-sky-400"
        >
          {pending ? "Sending..." : "Resend verification email"}
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

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<p className="mx-auto mt-20 w-full max-w-sm px-4 text-sm text-sky-500">Loading…</p>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
