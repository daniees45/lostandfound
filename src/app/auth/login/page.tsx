"use client";

import { useActionState } from "react";
import { login, type AuthState } from "@/app/actions/auth";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    login,
    undefined
  );
  const params = useSearchParams();
  const redirectTo = params.get("redirectTo") ?? "";
  const message = params.get("message");

  return (
    <div className="mx-auto mt-20 w-full max-w-sm px-4">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="mt-1 text-sm text-zinc-500">Valley View Lost &amp; Found</p>

      {message ? (
        <p className="mt-3 rounded-md bg-emerald-100 px-3 py-2 text-sm text-emerald-800">
          {message}
        </p>
      ) : null}

      <form action={action} className="mt-5 space-y-4">
        <input type="hidden" name="redirectTo" value={redirectTo} />

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
          <span className="mb-1 block">Password</span>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="w-full rounded-md border border-black/15 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-black/20 dark:border-white/20 dark:bg-black"
          />
          {state?.errors?.password ? (
            <p className="mt-1 text-xs text-rose-600">
              {state.errors.password[0]}
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
          className="w-full rounded-md bg-black py-2 text-sm text-white disabled:opacity-60 dark:bg-white dark:text-black"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>

        <p className="text-center text-sm text-zinc-500">
          No account?{" "}
          <Link
            href="/auth/signup"
            className="font-medium text-zinc-900 underline dark:text-zinc-100"
          >
            Create one
          </Link>
        </p>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
