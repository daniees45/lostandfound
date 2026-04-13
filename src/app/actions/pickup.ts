"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { notifyStatusChange } from "@/lib/notifications";

const PickupSchema = z.object({
  handoverCode: z
    .string()
    .regex(/^\d{6}$/, "Code must be exactly 6 digits."),
});

const ReleasePickupSchema = z
  .object({
    itemId: z.string().uuid(),
    claimantId: z.string().uuid(),
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

  const { data: officerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const officerRole = officerProfile?.role;
  if (officerRole !== "pickup_point" && officerRole !== "admin") {
    return { message: "Only pickup officers or admins can verify handover codes." };
  }

  const { data: item, error: itemError } = await supabase
    .from("items")
    .select("id, user_id, title, status, pickup_code")
    .eq("pickup_code", parsed.data.handoverCode)
    .maybeSingle();

  if (itemError) {
    return { message: itemError.message };
  }

  if (!item) {
    return { message: "Invalid handover code." };
  }

  if (item.status !== "found" && item.status !== "claimed") {
    return { message: `Item is already in status: ${item.status}.` };
  }

  const { error: updateError } = await supabase
    .from("items")
    .update({ status: "held_at_pickup" })
    .eq("id", item.id);

  if (updateError) {
    return { message: updateError.message };
  }

  await supabase.from("custody_logs").insert({
    item_id: item.id,
    from_user_id: item.user_id,
    to_user_id: user.id,
    verification_method: "handover_code",
    notes: `Handover verified using code ${parsed.data.handoverCode}`,
  });

  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", item.user_id)
    .maybeSingle();

  await notifyStatusChange({
    supabase,
    userId: item.user_id,
    email: ownerProfile?.email,
    itemTitle: item.title,
    newStatus: "held_at_pickup",
  });

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

  const { data: officerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const officerRole = officerProfile?.role;
  if (officerRole !== "pickup_point" && officerRole !== "admin") {
    return { message: "Only pickup officers or admins can release held items." };
  }

  const { data: item, error: itemError } = await supabase
    .from("items")
    .select("id, user_id, title, status")
    .eq("id", parsed.data.itemId)
    .maybeSingle();

  if (itemError) {
    return { message: itemError.message };
  }

  if (!item) {
    return { message: "Held item not found." };
  }

  if (item.status !== "held_at_pickup") {
    return { message: `Only held items can be released. Current status: ${item.status}.` };
  }

  const { data: approvedClaim, error: claimError } = await supabase
    .from("claims")
    .select("id, claimant_id")
    .eq("item_id", item.id)
    .eq("claimant_id", parsed.data.claimantId)
    .eq("status", "approved")
    .maybeSingle();

  if (claimError) {
    return { message: claimError.message };
  }

  if (!approvedClaim) {
    return { message: "This claimant does not have an approved claim for the selected item." };
  }

  const { error: updateError } = await supabase
    .from("items")
    .update({ status: "returned" })
    .eq("id", item.id);

  if (updateError) {
    return { message: updateError.message };
  }

  const releaseNote = parsed.data.notes?.trim()
    ? `Final release completed. ${parsed.data.notes.trim()}`
    : "Final release completed after identity verification.";

  const { error: custodyError } = await supabase.from("custody_logs").insert({
    item_id: item.id,
    from_user_id: user.id,
    to_user_id: approvedClaim.claimant_id,
    verification_method: parsed.data.verificationMethod,
    notes: releaseNote,
  });

  if (custodyError) {
    return { message: custodyError.message };
  }

  const { data: relatedProfiles } = await supabase
    .from("profiles")
    .select("id, email")
    .in("id", [item.user_id, approvedClaim.claimant_id]);

  const profileMap = new Map((relatedProfiles ?? []).map((profile) => [profile.id as string, profile.email as string | null]));

  await notifyStatusChange({
    supabase,
    userId: approvedClaim.claimant_id,
    email: profileMap.get(approvedClaim.claimant_id) ?? null,
    itemTitle: item.title,
    newStatus: "returned",
  });

  await notifyStatusChange({
    supabase,
    userId: item.user_id,
    email: profileMap.get(item.user_id) ?? null,
    itemTitle: item.title,
    newStatus: "returned",
  });

  revalidatePath("/pickup");
  revalidatePath("/dashboard");
  revalidatePath("/items");

  return {
    success: true,
    message: `\"${item.title}\" was released to the approved claimant and marked as returned.`,
  };
}