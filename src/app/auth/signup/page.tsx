"use client";

import { useActionState } from "react";
import { signup, type AuthState } from "@/app/actions/auth";
import Link from "next/link";

export default function SignupPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    signup,
    undefined
  );

  return (
    <div className="mx-auto mt-16 w-full max-w-sm px-4">
      <h1 className="text-2xl font-semibold">Create account</h1>
      <p className="mt-1 text-sm text-zinc-500">Valley View Lost &amp; Found</p>

      <form action={action} className="mt-5 space-y-4">
        <label className="block text-sm">
          <span className="mb-1 block">Full name</span>
          <input
            name="fullName"
            required
            autoComplete="name"
            className="w-full rounded-md border border-black/15 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-black/20 dark:border-white/20 dark:bg-black"
          />
          {state?.errors?.fullName ? (
            <p className="mt-1 text-xs text-rose-600">
              {state.errors.fullName[0]}
            </p>
          ) : null}
        </label>

        <label className="block text-sm">
          <span className="mb-1 block">Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full rounded-md border border-black/15 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-black/20 dark:border-white/20 dark:bg-black"
          />
          {state?.errors?.email ? (
            <p className="mt-1 text-xs text-rose-600">{state.errors.email[0]}</p>
          ) : null}
        </label>

        <label className="block text-sm">
          <span className="mb-1 block">Password (min. 8 characters)</span>
          <input
            name="password"
            type="password"
            required
            autoComplete="new-password"
            className="w-full rounded-md border border-black/15 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-black/20 dark:border-white/20 dark:bg-black"
          />
          {state?.errors?.password ? (
            <p className="mt-1 text-xs text-rose-600">
              {state.errors.password[0]}
            </p>
          ) : null}
        </label>

        <p className="rounded-md bg-zinc-100 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          New accounts are created as <strong>student</strong>. Staff roles are assigned separately by an administrator.
        </p>

        {state?.message ? (
          <p className="rounded-md bg-rose-100 px-3 py-2 text-sm text-rose-800">
            {state.message}
          </p>
        ) : null}

        <button
          disabled={pending}
          className="w-full rounded-md bg-black py-2 text-sm text-white disabled:opacity-60 dark:bg-white dark:text-black"
        >
          {pending ? "Creating account…" : "Create account"}
        </button>

        <p className="text-center text-sm text-zinc-500">
          Already have an account?{" "}
          <Link
            href="/auth/login"
            className="font-medium text-zinc-900 underline dark:text-zinc-100"
          >
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
