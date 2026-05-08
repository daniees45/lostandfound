"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { initializeDatabase } from "@/lib/db";
import { items as itemsTable, profiles, claims as claimsTable, custody_logs } from "@/lib/schema";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { notifyStatusChange } from "@/lib/notifications";
import { eq, or } from "drizzle-orm";
import { randomUUID } from "crypto";

const PickupSchema = z.object({
  handoverCode: z
    .string()
    .regex(/^\d{6}$/, "Code must be exactly 6 digits."),
});

const ReleasePickupSchema = z
  .object({
    itemId: z.string(),
    claimantId: z.string(),
    verificationMethod: z.enum(["id_card", "manual_override"]),
    notes: z.string().max(500).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.verificationMethod === "manual_override" && !value.notes?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["notes"],
        message: "Notes are required for manual override.",
      });
    }
  });

export type PickupState =
  | {
      errors?: Record<string, string[]>;
      message?: string;
      success?: boolean;
    }
  | undefined;

export async function verifyPickupCode(
  _state: PickupState,
  formData: FormData
): Promise<PickupState> {
  const parsed = PickupSchema.safeParse({
    handoverCode: formData.get("handoverCode"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { message: "You must be signed in to verify a code." };
  }

  const db = initializeDatabase();

  // Get officer profile role
  const officerProfile = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .get();

  const officerRole = officerProfile?.role;
  if (officerRole !== "pickup_point" && officerRole !== "admin") {
    return { message: "Only pickup officers or admins can verify handover codes." };
  }

  // Find item by pickup code
  const item = await db
    .select({
      id: itemsTable.id,
      user_id: itemsTable.user_id,
      title: itemsTable.title,
      status: itemsTable.status,
      pickup_code: itemsTable.pickup_code,
    })
    .from(itemsTable)
    .where(eq(itemsTable.pickup_code, parsed.data.handoverCode))
    .get();

  if (!item) {
    return { message: "Invalid handover code." };
  }

  if (item.status !== "found" && item.status !== "claimed") {
    return { message: `Item is already in status: ${item.status}.` };
  }

  try {
    // Update item status to held_at_pickup
    await db
      .update(itemsTable)
      .set({ status: "held_at_pickup" })
      .where(eq(itemsTable.id, item.id));

    // Create custody log
    const logId = `log_${randomUUID()}`;
    await db.insert(custody_logs).values({
      id: logId,
      item_id: item.id,
      from_user_id: item.user_id,
      to_user_id: user.id,
      verification_method: "handover_code",
      notes: `Handover verified using code ${parsed.data.handoverCode}`,
    });

    // Get owner profile for notification
    const ownerProfile = await db
      .select({ email: profiles.email })
      .from(profiles)
      .where(eq(profiles.id, item.user_id))
      .get();

    await notifyStatusChange({
      supabase,
      userId: item.user_id,
      email: ownerProfile?.email,
      itemTitle: item.title,
      newStatus: "held_at_pickup",
    });
  } catch (err) {
    console.error("Error verifying pickup code:", err);
    return { message: "Failed to verify code. Please try again." };
  }

  revalidatePath("/pickup");
  revalidatePath("/dashboard");
  revalidatePath("/items");

  return {
    success: true,
    message: `Code accepted. \"${item.title}\" moved to pickup custody.`,
  };
}

export async function releaseHeldItem(
  _state: PickupState,
  formData: FormData
): Promise<PickupState> {
  const parsed = ReleasePickupSchema.safeParse({
    itemId: formData.get("itemId"),
    claimantId: formData.get("claimantId"),
    verificationMethod: formData.get("verificationMethod"),
    notes: (formData.get("notes") as string | null) ?? undefined,
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { message: "You must be signed in to release an item." };
  }

  const db = initializeDatabase();

  // Get officer profile role
  const officerProfile = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .get();

  const officerRole = officerProfile?.role;
  if (officerRole !== "pickup_point" && officerRole !== "admin") {
    return { message: "Only pickup officers or admins can release held items." };
  }

  // Get item
  const item = await db
    .select({
      id: itemsTable.id,
      user_id: itemsTable.user_id,
      title: itemsTable.title,
      status: itemsTable.status,
    })
    .from(itemsTable)
    .where(eq(itemsTable.id, parsed.data.itemId))
    .get();

  if (!item) {
    return { message: "Held item not found." };
  }

  if (item.status !== "held_at_pickup") {
    return { message: `Only held items can be released. Current status: ${item.status}.` };
  }

  // Check approved claim
  const approvedClaim = await db
    .select({
      id: claimsTable.id,
      claimant_id: claimsTable.claimant_id,
    })
    .from(claimsTable)
    .where(
      eq(claimsTable.item_id, item.id) &&
      eq(claimsTable.claimant_id, parsed.data.claimantId) &&
      eq(claimsTable.status, "approved")
    )
    .get();

  if (!approvedClaim) {
    return { message: "This claimant does not have an approved claim for the selected item." };
  }

  try {
    // Update item status to returned
    await db
      .update(itemsTable)
      .set({ status: "returned" })
      .where(eq(itemsTable.id, item.id));

    const releaseNote = parsed.data.notes?.trim()
      ? `Final release completed. ${parsed.data.notes.trim()}`
      : "Final release completed after identity verification.";

    // Create custody log for release
    const logId = `log_${randomUUID()}`;
    await db.insert(custody_logs).values({
      id: logId,
      item_id: item.id,
      from_user_id: user.id,
      to_user_id: approvedClaim.claimant_id,
      verification_method: parsed.data.verificationMethod,
      notes: releaseNote,
    });

    // Get related profiles for notification
    const relatedProfiles = await db
      .select({
        id: profiles.id,
        email: profiles.email,
      })
      .from(profiles)
      .where(
        or(
          eq(profiles.id, item.user_id),
          eq(profiles.id, approvedClaim.claimant_id)
        )
      );

    const profileMap = new Map(
      relatedProfiles.map((profile) => [profile.id, profile.email])
    );

    // Notify claimant
    await notifyStatusChange({
      supabase,
      userId: approvedClaim.claimant_id,
      email: profileMap.get(approvedClaim.claimant_id) ?? null,
      itemTitle: item.title,
      newStatus: "returned",
    });

    // Notify owner
    await notifyStatusChange({
      supabase,
      userId: item.user_id,
      email: profileMap.get(item.user_id) ?? null,
      itemTitle: item.title,
      newStatus: "returned",
    });
  } catch (err) {
    console.error("Error releasing held item:", err);
    return { message: "Failed to release item. Please try again." };
  }

  revalidatePath("/pickup");
  revalidatePath("/dashboard");
  revalidatePath("/items");

  return {
    success: true,
    message: `\"${item.title}\" was released to the approved claimant and marked as returned.`,
  };
}