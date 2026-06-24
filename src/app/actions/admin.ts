"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { initializeDatabase } from "@/lib/db";
import { profiles, items as itemsTable, claims as claimsTable } from "@/lib/schema";
import { setSiteLogoUrl } from "@/lib/app-settings";
import {
  cloudinaryReady,
  uploadImageToCloudinary,
  validateImageUpload,
} from "@/lib/cloudinary";
import { z } from "zod";
import { eq } from "drizzle-orm";

export type AdminActionState =
  | { message?: string; success?: boolean; errors?: Record<string, string[]> }
  | undefined;

// ── helpers ───────────────────────────────────────────────────────────────────

async function assertAdmin() {
  const user = await getCurrentUser();

  if (!user) return { error: "Not authenticated.", db: null, user: null };

  const db = initializeDatabase();
  const profile = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .get();

  if (profile?.role !== "admin") {
    return { error: "Forbidden. Admin role required.", db: null, user: null };
  }

  return { error: null, db, user };
}

// ── items ─────────────────────────────────────────────────────────────────────

const UpdateItemSchema = z.object({
  itemId: z.string(),
  title: z.string().min(2),
  category: z.string().min(1),
  description: z.string().min(10),
  location: z.string().min(2),
  status: z.enum(["lost", "found", "claimed", "returned", "held_at_pickup"]),
});

export async function adminUpdateItem(
  _state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const { error: authError, db } = await assertAdmin();
  if (authError || !db) return { message: authError ?? "Unexpected error." };

  const parsed = UpdateItemSchema.safeParse({
    itemId: formData.get("itemId"),
    title: formData.get("title"),
    category: formData.get("category"),
    description: formData.get("description"),
    location: formData.get("location"),
    status: formData.get("status"),
  });

  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  try {
    await db
      .update(itemsTable)
      .set({
        title: parsed.data.title,
        category: parsed.data.category,
        description: parsed.data.description,
        location: parsed.data.location,
        status: parsed.data.status,
      })
      .where(eq(itemsTable.id, parsed.data.itemId));
  } catch (err) {
    console.error("Error updating item:", err);
    return { message: "Failed to update item." };
  }

  revalidatePath("/admin");
  revalidatePath("/items");
  revalidatePath("/dashboard");
  return { success: true, message: "Item updated." };
}

const DeleteItemSchema = z.object({
  itemId: z.string(),
});

export async function adminDeleteItem(
  _state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const { error: authError, db } = await assertAdmin();
  if (authError || !db) return { message: authError ?? "Unexpected error." };

  const parsed = DeleteItemSchema.safeParse({ itemId: formData.get("itemId") });
  if (!parsed.success) return { message: "Invalid item ID." };

  try {
    await db.delete(itemsTable).where(eq(itemsTable.id, parsed.data.itemId));
  } catch (err) {
    console.error("Error deleting item:", err);
    return { message: "Failed to delete item." };
  }

  revalidatePath("/admin");
  revalidatePath("/items");
  revalidatePath("/dashboard");
  return { success: true, message: "Item deleted." };
}

// ── users ─────────────────────────────────────────────────────────────────────

const UpdateUserRoleSchema = z.object({
  userId: z.string(),
  role: z.enum(["student", "admin", "pickup_point"]),
});

export async function adminUpdateUserRole(
  _state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const { error: authError, db, user: adminUser } = await assertAdmin();
  if (authError || !db || !adminUser) return { message: authError ?? "Unexpected error." };

  const parsed = UpdateUserRoleSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
  });

  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  try {
    await db
      .update(profiles)
      .set({ role: parsed.data.role })
      .where(eq(profiles.id, parsed.data.userId));
  } catch (err) {
    console.error("Error updating user role:", err);
    return { message: "Failed to update role." };
  }

  revalidatePath("/admin");
  return { success: true, message: "Role updated." };
}

// ── claims ────────────────────────────────────────────────────────────────────

const DeleteClaimSchema = z.object({
  claimId: z.string(),
});

export async function adminDeleteClaim(
  _state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const { error: authError, db } = await assertAdmin();
  if (authError || !db) return { message: authError ?? "Unexpected error." };

  const parsed = DeleteClaimSchema.safeParse({ claimId: formData.get("claimId") });
  if (!parsed.success) return { message: "Invalid claim ID." };

  try {
    await db.delete(claimsTable).where(eq(claimsTable.id, parsed.data.claimId));
  } catch (err) {
    console.error("Error deleting claim:", err);
    return { message: "Failed to delete claim." };
  }

  revalidatePath("/admin");
  return { success: true, message: "Claim deleted." };
}

// ── branding ─────────────────────────────────────────────────────────────────

export async function adminUpdateLogo(
  _state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const { error: authError } = await assertAdmin();
  if (authError) return { message: authError };

  const resetToDefault = formData.get("resetToDefault") === "1";
  if (resetToDefault) {
    try {
      await setSiteLogoUrl(null);
    } catch (err) {
      console.error("Error resetting logo:", err);
      return { message: "Failed to reset logo." };
    }

    revalidatePath("/");
    revalidatePath("/admin");
    return { success: true, message: "Logo reset to default." };
  }

  const logoFile = formData.get("logo");
  if (!(logoFile instanceof File) || logoFile.size <= 0) {
    return { message: "Please choose an image file to upload." };
  }

  const validationError = validateImageUpload(logoFile);
  if (validationError) {
    return { message: validationError };
  }

  if (!cloudinaryReady()) {
    return {
      message:
        "Logo upload requires Cloudinary setup (prefer CLOUDINARY_URL, or CLOUDINARY_CLOUD_NAME + CLOUDINARY_UPLOAD_PRESET).",
    };
  }

  try {
    const logoUrl = await uploadImageToCloudinary(logoFile, "lost-found-system/branding");
    await setSiteLogoUrl(logoUrl);
  } catch (err) {
    console.error("Error uploading logo:", err);
    return { message: "Failed to upload logo." };
  }

  revalidatePath("/");
  revalidatePath("/admin");
  return { success: true, message: "Logo updated." };
}
