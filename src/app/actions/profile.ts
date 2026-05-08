"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { initializeDatabase } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { profiles } from "@/lib/schema";
import { cloudinaryReady, uploadImageToCloudinary } from "@/lib/cloudinary";

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

const ProfileSchema = z.object({
  fullName: z.string().trim().min(2, "Full name must be at least 2 characters."),
  removeAvatar: z.string().optional(),
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
    if (!imageFile.type.startsWith("image/")) {
      return { message: "Avatar must be an image.", success: false };
    }

    if (imageFile.size > MAX_IMAGE_SIZE_BYTES) {
      return { message: "Avatar must be 5MB or smaller.", success: false };
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
      ...(avatarUrl !== undefined ? { avatar_url: avatarUrl } : {}),
    })
    .where(eq(profiles.id, user.id));

  return { message: "Profile updated successfully.", success: true };
}
