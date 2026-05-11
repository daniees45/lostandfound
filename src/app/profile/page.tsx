import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { initializeDatabase } from "@/lib/db";
import { profiles } from "@/lib/schema";
import { ProfileForm } from "@/components/profile-form";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth/login?redirectTo=/profile");
  }

  const db = initializeDatabase();
  const profile = await db
    .select({
      full_name: profiles.full_name,
      email: profiles.email,
      avatar_url: profiles.avatar_url,
      role: profiles.role,
      preferred_language: profiles.preferred_language,
      timezone: profiles.timezone,
      digest_frequency: profiles.digest_frequency,
      email_notifications_enabled: profiles.email_notifications_enabled,
      in_app_notifications_enabled: profiles.in_app_notifications_enabled,
    })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .get();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Profile Settings</h1>
      <p className="mt-1 text-sm text-sky-600 dark:text-sky-400">
        Manage your name and optional profile image.
      </p>

      <div className="mt-6 rounded-2xl border border-sky-200 bg-white p-6 dark:border-sky-800 dark:bg-sky-950">
        <ProfileForm
          fullName={profile?.full_name || ""}
          email={profile?.email || user.email}
          avatarUrl={profile?.avatar_url || null}
          role={profile?.role || "student"}
          preferredLanguage={profile?.preferred_language || "en"}
          timezone={profile?.timezone || "UTC"}
          digestFrequency={profile?.digest_frequency || "instant"}
          emailNotificationsEnabled={profile?.email_notifications_enabled ?? true}
          inAppNotificationsEnabled={profile?.in_app_notifications_enabled ?? true}
        />
      </div>
    </div>
  );
}
