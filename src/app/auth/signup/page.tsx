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
      <p className="mt-1 text-sm text-sky-500">Valley View Lost &amp; Found</p>

      <form action={action} className="mt-5 space-y-4" encType="multipart/form-data">
        <label className="block text-sm">
          <span className="mb-1 block">Full name</span>
          <input
            name="fullName"
            required
            autoComplete="name"
            className="w-full rounded-md border border-sky-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-400 dark:border-sky-700 dark:bg-sky-950"
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
            className="w-full rounded-md border border-sky-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-400 dark:border-sky-700 dark:bg-sky-950"
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
            className="w-full rounded-md border border-sky-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-400 dark:border-sky-700 dark:bg-sky-950"
          />
          {state?.errors?.password ? (
            <p className="mt-1 text-xs text-rose-600">
              {state.errors.password[0]}
            </p>
          ) : null}
        </label>

        <label className="block text-sm">
          <span className="mb-1 block">Profile image (optional)</span>
          <input
            name="avatar"
            type="file"
            accept="image/*"
            className="w-full rounded-md border border-sky-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-400 dark:border-sky-700 dark:bg-sky-950"
          />
        </label>

        <p className="rounded-md bg-sky-100 px-3 py-2 text-sm text-sky-800 dark:bg-sky-900 dark:text-sky-200">
          New accounts are created as <strong>student</strong>. Staff roles are assigned separately by an administrator. You must verify your email before signing in.
        </p>

        {state?.message ? (
          <p className="rounded-md bg-rose-100 px-3 py-2 text-sm text-rose-800">
            {state.message}
          </p>
        ) : null}

        <button
          disabled={pending}
          className="w-full rounded-md bg-sky-600 py-2 text-sm text-white hover:bg-sky-700 disabled:opacity-60 dark:bg-sky-500 dark:hover:bg-sky-400"
        >
          {pending ? "Creating account…" : "Create account"}
        </button>

        <p className="text-center text-sm text-sky-600 dark:text-sky-400">
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
