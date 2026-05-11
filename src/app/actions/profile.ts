"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { initializeDatabase } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { profiles } from "@/lib/schema";
import {
  cloudinaryReady,
  uploadImageToCloudinary,
  validateImageUpload,
} from "@/lib/cloudinary";

const ProfileSchema = z.object({
  fullName: z.string().trim().min(2, "Full name must be at least 2 characters."),
  removeAvatar: z.string().optional(),
  preferredLanguage: z.enum(["en", "fr", "es"]).default("en"),
  timezone: z
    .string()
    .trim()
    .min(2, "Timezone is required.")
    .max(64, "Timezone is too long."),
  digestFrequency: z.enum(["instant", "daily", "weekly"]).default("instant"),
  emailNotificationsEnabled: z.boolean(),
  inAppNotificationsEnabled: z.boolean(),
});

export type ProfileState =
  | { errors?: Record<string, string[]>; message?: string; success?: boolean }
  | undefined;

export async function updateProfile(
  _state: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const user = await getCurrentUser();
  if (!user) {
    return { message: "You must be signed in.", success: false };
  }

  const parsed = ProfileSchema.safeParse({
    fullName: formData.get("fullName"),
    removeAvatar: formData.get("removeAvatar"),
    preferredLanguage: formData.get("preferredLanguage") ?? "en",
    timezone: formData.get("timezone") ?? "UTC",
    digestFrequency: formData.get("digestFrequency") ?? "instant",
    emailNotificationsEnabled: formData.get("emailNotificationsEnabled") === "1",
    inAppNotificationsEnabled: formData.get("inAppNotificationsEnabled") === "1",
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, success: false };
  }

  const imageFile = formData.get("avatar");
  let avatarUrl: string | null | undefined = undefined;

  if (parsed.data.removeAvatar === "1") {
    avatarUrl = null;
  }

  if (imageFile instanceof File && imageFile.size > 0) {
    const validationError = validateImageUpload(imageFile);
    if (validationError) {
      return { message: validationError, success: false };
    }

    if (!cloudinaryReady()) {
      return {
        message:
          "Profile image upload requires Cloudinary setup (CLOUDINARY_CLOUD_NAME + CLOUDINARY_UPLOAD_PRESET).",
        success: false,
      };
    }

    try {
      avatarUrl = await uploadImageToCloudinary(imageFile, "lost-found-system/avatars");
    } catch (error) {
      console.error("Avatar upload failed:", error);
      return { message: "Could not upload profile image.", success: false };
    }
  }

  const db = initializeDatabase();
  await db
    .update(profiles)
    .set({
      full_name: parsed.data.fullName,
      preferred_language: parsed.data.preferredLanguage,
      timezone: parsed.data.timezone,
      digest_frequency: parsed.data.digestFrequency,
      email_notifications_enabled: parsed.data.emailNotificationsEnabled,
      in_app_notifications_enabled: parsed.data.inAppNotificationsEnabled,
      ...(avatarUrl !== undefined ? { avatar_url: avatarUrl } : {}),
    })
    .where(eq(profiles.id, user.id));

  return { message: "Profile updated successfully.", success: true };
}
