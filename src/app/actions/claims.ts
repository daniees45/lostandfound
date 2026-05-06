"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { notifyStatusChange } from "@/lib/notifications";
import { assessClaimCredibility, getEvidenceQuestions } from "@/lib/ai-service-client";
import { z } from "zod";

const CreateClaimSchema = z.object({
  itemId: z.string().uuid(),
  proofDescription: z.string().max(500).optional(),
});

const ReviewClaimSchema = z.object({
  claimId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
});

export type ClaimState =
  | {
      message?: string;
      success?: boolean;
      errors?: Record<string, string[]>;
    }
  | undefined;

export async function createClaim(
  _state: ClaimState,
  formData: FormData
): Promise<ClaimState> {
  const parsed = CreateClaimSchema.safeParse({
    itemId: formData.get("itemId"),
    proofDescription: (formData.get("proofDescription") as string | null) ?? undefined,
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { message: "You must be signed in to submit a claim." };
  }

  const { data: item, error: itemError } = await supabase
    .from("items")
    .select("id, user_id, status, category, description")
    .eq("id", parsed.data.itemId)
    .maybeSingle();

  if (itemError) {
    return { message: itemError.message };
  }

  if (!item) {
    return { message: "Item not found." };
  }

  if (item.user_id === user.id) {
    return { message: "You cannot claim your own item." };
  }

  if (!["found", "held_at_pickup", "claimed"].includes(item.status)) {
    return { message: "This item is not available for claims." };
  }

  const { data: existingClaim } = await supabase
    .from("claims")
    .select("id, status")
    .eq("item_id", item.id)
    .eq("claimant_id", user.id)
    .in("status", ["pending", "approved"])
    .maybeSingle();

  if (existingClaim) {
    return { message: `You already have a ${existingClaim.status} claim for this item.` };
  }

  const proofText = parsed.data.proofDescription ?? "";
  const credibility = await assessClaimCredibility(
    proofText,
    item.category ?? "Others",
    item.description ?? ""
  );
  const evidence = await getEvidenceQuestions(item.category ?? "Others", item.description ?? "");

  const aiMetaLines: string[] = [];
  if (credibility?.credibility_score != null) {
    aiMetaLines.push(`[AI credibility score: ${credibility.credibility_score}]`);
  }
  if (Array.isArray(evidence?.questions) && evidence.questions.length > 0) {
    aiMetaLines.push(`[AI evidence prompts: ${evidence.questions.slice(0, 2).join(" | ")}]`);
  }

  const enrichedProof = [proofText, ...aiMetaLines].filter(Boolean).join("\n\n");

  const { error } = await supabase.from("claims").insert({
    item_id: item.id,
    claimant_id: user.id,
    proof_description: enrichedProof || null,
    status: "pending",
  });

  if (error) {
    return { message: error.message };
  }

  revalidatePath("/items");
  revalidatePath("/dashboard");
  return { success: true, message: "Claim submitted. The owner will review it." };
}

export async function submitClaimAction(formData: FormData) {
  const result = await createClaim(undefined, formData);
  const claimSuccess = result?.success ? "1" : "0";
  const claimMessage = encodeURIComponent(result?.message ?? "Unable to submit claim.");
  redirect(`/items?claimSuccess=${claimSuccess}&claimMessage=${claimMessage}`);
}

export async function reviewClaim(
  _state: ClaimState,
  formData: FormData
): Promise<ClaimState> {
  const parsed = ReviewClaimSchema.safeParse({
    claimId: formData.get("claimId"),
    decision: formData.get("decision"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { message: "You must be signed in to review a claim." };
  }

  const { data: claim, error: claimError } = await supabase
    .from("claims")
    .select("id, item_id, claimant_id, status")
    .eq("id", parsed.data.claimId)
    .maybeSingle();

  if (claimError) {
    return { message: claimError.message };
  }

  if (!claim) {
    return { message: "Claim not found." };
  }

  if (claim.status !== "pending") {
    return { message: "Only pending claims can be reviewed." };
  }

  const { data: item, error: itemError } = await supabase
    .from("items")
    .select("id, user_id, title")
    .eq("id", claim.item_id)
    .maybeSingle();

  if (itemError) {
    return { message: itemError.message };
  }

  if (!item) {
    return { message: "Item attached to this claim was not found." };
  }

  if (item.user_id !== user.id) {
    return { message: "Only the item owner can review claims." };
  }

  const { error: claimUpdateError } = await supabase
    .from("claims")
    .update({ status: parsed.data.decision })
    .eq("id", claim.id);

  if (claimUpdateError) {
    return { message: claimUpdateError.message };
  }

  if (parsed.data.decision === "approved") {
    const { error: itemUpdateError } = await supabase
      .from("items")
      .update({ status: "claimed" })
      .eq("id", item.id);

    if (itemUpdateError) {
      return { message: itemUpdateError.message };
    }

    const { data: claimantProfile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", claim.claimant_id)
      .maybeSingle();

    await notifyStatusChange({
      supabase,
      userId: claim.claimant_id,
      email: claimantProfile?.email,
      itemTitle: item.title,
      newStatus: "claimed",
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/items");

  return {
    success: true,
    message:
      parsed.data.decision === "approved"
        ? "Claim approved and item marked as claimed."
        : "Claim rejected.",
  };
}

export async function reviewClaimAction(formData: FormData) {
  const result = await reviewClaim(undefined, formData);
  const claimSuccess = result?.success ? "1" : "0";
  const claimMessage = encodeURIComponent(result?.message ?? "Unable to review claim.");
  redirect(`/dashboard?claimSuccess=${claimSuccess}&claimMessage=${claimMessage}`);
}