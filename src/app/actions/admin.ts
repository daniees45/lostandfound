"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { z } from "zod";

export type AdminActionState =
  | { message?: string; success?: boolean; errors?: Record<string, string[]> }
  | undefined;

// ── helpers ───────────────────────────────────────────────────────────────────

async function assertAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated.", supabase: null, user: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { error: "Forbidden. Admin role required.", supabase: null, user: null };
  }

  return { error: null, supabase, user };
}

// ── items ─────────────────────────────────────────────────────────────────────

const UpdateItemSchema = z.object({
  itemId: z.string().uuid(),
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
  const { error: authError, supabase } = await assertAdmin();
  if (authError || !supabase) return { message: authError ?? "Unexpected error." };

  const parsed = UpdateItemSchema.safeParse({
    itemId: formData.get("itemId"),
    title: formData.get("title"),
    category: formData.get("category"),
    description: formData.get("description"),
    location: formData.get("location"),
    status: formData.get("status"),
  });

  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const { error } = await supabase
    .from("items")
    .update({
      title: parsed.data.title,
      category: parsed.data.category,
      description: parsed.data.description,
      location: parsed.data.location,
      status: parsed.data.status,
    })
    .eq("id", parsed.data.itemId);

  if (error) return { message: error.message };

  revalidatePath("/admin");
  revalidatePath("/items");
  revalidatePath("/dashboard");
  return { success: true, message: "Item updated." };
}

const DeleteItemSchema = z.object({
  itemId: z.string().uuid(),
});

export async function adminDeleteItem(
  _state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const { error: authError, supabase } = await assertAdmin();
  if (authError || !supabase) return { message: authError ?? "Unexpected error." };

  const parsed = DeleteItemSchema.safeParse({ itemId: formData.get("itemId") });
  if (!parsed.success) return { message: "Invalid item ID." };

  const { error } = await supabase
    .from("items")
    .delete()
    .eq("id", parsed.data.itemId);

  if (error) return { message: error.message };

  revalidatePath("/admin");
  revalidatePath("/items");
  revalidatePath("/dashboard");
  return { success: true, message: "Item deleted." };
}

// ── users ─────────────────────────────────────────────────────────────────────

const UpdateUserRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["student", "admin", "pickup_point"]),
});

export async function adminUpdateUserRole(
  _state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const { error: authError, supabase, user: adminUser } = await assertAdmin();
  if (authError || !supabase || !adminUser) return { message: authError ?? "Unexpected error." };

  const parsed = UpdateUserRoleSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
  });

  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const { error } = await supabase
    .from("profiles")
    .update({ role: parsed.data.role })
    .eq("id", parsed.data.userId);

  if (error) return { message: error.message };

  revalidatePath("/admin");
  return { success: true, message: "Role updated." };
}

// ── claims ────────────────────────────────────────────────────────────────────

const DeleteClaimSchema = z.object({
  claimId: z.string().uuid(),
});

export async function adminDeleteClaim(
  _state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const { error: authError, supabase } = await assertAdmin();
  if (authError || !supabase) return { message: authError ?? "Unexpected error." };

  const parsed = DeleteClaimSchema.safeParse({ claimId: formData.get("claimId") });
  if (!parsed.success) return { message: "Invalid claim ID." };

  const { error } = await supabase
    .from("claims")
    .delete()
    .eq("id", parsed.data.claimId);

  if (error) return { message: error.message };

  revalidatePath("/admin");
  return { success: true, message: "Claim deleted." };
}
