"use client";

import { useActionState, useState } from "react";
import { updateProfile, type ProfileState } from "@/app/actions/profile";

type ProfileFormProps = {
  fullName: string;
  email: string;
  avatarUrl: string | null;
  role: string;
};

export function ProfileForm({ fullName, email, avatarUrl, role }: ProfileFormProps) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(
    updateProfile,
    undefined
  );
  const [removeAvatar, setRemoveAvatar] = useState(false);

  return (
    <form action={action} className="space-y-4" encType="multipart/form-data">
      <div className="flex items-center gap-4">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt="Profile"
            className="h-16 w-16 rounded-full object-cover border border-sky-200 dark:border-sky-700"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-200">
            {fullName.slice(0, 1).toUpperCase() || "U"}
          </div>
        )}
        <div>
          <p className="text-sm font-medium">{email}</p>
          <p className="text-xs text-sky-600 dark:text-sky-400">Role: {role}</p>
        </div>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block">Full name</span>
        <input
          name="fullName"
          defaultValue={fullName}
          required
          className="w-full rounded-md border border-sky-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-400 dark:border-sky-700 dark:bg-sky-950"
        />
        {state?.errors?.fullName ? (
          <p className="mt-1 text-xs text-rose-600">{state.errors.fullName[0]}</p>
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

      {avatarUrl ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={removeAvatar}
            onChange={(e) => setRemoveAvatar(e.target.checked)}
          />
          Remove current profile image
        </label>
      ) : null}

      {removeAvatar ? <input type="hidden" name="removeAvatar" value="1" /> : null}

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
        disabled={pending}
        className="rounded-md bg-sky-600 px-4 py-2 text-sm text-white hover:bg-sky-700 disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save profile"}
      </button>
    </form>
  );
}
