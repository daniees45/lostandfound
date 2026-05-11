"use client";

import { useActionState, useState } from "react";
import { updateProfile, type ProfileState } from "@/app/actions/profile";

type ProfileFormProps = {
  fullName: string;
  email: string;
  avatarUrl: string | null;
  role: string;
  preferredLanguage: "en" | "fr" | "es";
  timezone: string;
  digestFrequency: "instant" | "daily" | "weekly";
  emailNotificationsEnabled: boolean;
  inAppNotificationsEnabled: boolean;
};

export function ProfileForm({
  fullName,
  email,
  avatarUrl,
  role,
  preferredLanguage,
  timezone,
  digestFrequency,
  emailNotificationsEnabled,
  inAppNotificationsEnabled,
}: ProfileFormProps) {
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

      <div className="rounded-md border border-sky-200 p-4 dark:border-sky-800">
        <p className="text-sm font-medium">Notification and app settings</p>
        <p className="mt-1 text-xs text-sky-600 dark:text-sky-400">
          These preferences apply to all account roles, including student, admin, and pickup point access.
        </p>

        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block">Language</span>
            <select
              name="preferredLanguage"
              defaultValue={preferredLanguage}
              className="w-full rounded-md border border-sky-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-400 dark:border-sky-700 dark:bg-sky-950"
            >
              <option value="en">English</option>
              <option value="fr">French</option>
              <option value="es">Spanish</option>
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block">Timezone</span>
            <input
              name="timezone"
              defaultValue={timezone}
              placeholder="UTC"
              className="w-full rounded-md border border-sky-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-400 dark:border-sky-700 dark:bg-sky-950"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block">Digest frequency</span>
            <select
              name="digestFrequency"
              defaultValue={digestFrequency}
              className="w-full rounded-md border border-sky-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-400 dark:border-sky-700 dark:bg-sky-950"
            >
              <option value="instant">Instant</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </label>
        </div>

        <div className="mt-3 space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="emailNotificationsEnabled"
              value="1"
              defaultChecked={emailNotificationsEnabled}
            />
            Email notifications
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="inAppNotificationsEnabled"
              value="1"
              defaultChecked={inAppNotificationsEnabled}
            />
            In-app notifications
          </label>
        </div>
      </div>

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
