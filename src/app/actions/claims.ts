"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { initializeDatabase } from "@/lib/db";
import { claims as claimsTable, items as itemsTable, profiles } from "@/lib/schema";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { notifyStatusChange } from "@/lib/notifications";
import { assessClaimCredibility, getEvidenceQuestions } from "@/lib/ai-service-client";
import { z } from "zod";
import { eq, and, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";

const CreateClaimSchema = z.object({
  itemId: z.string(),
  proofDescription: z.string().max(500).optional(),
});

const ReviewClaimSchema = z.object({
  claimId: z.string(),
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

  const db = initializeDatabase();

  // Get item from Turso
  const item = await db
    .select({
      id: itemsTable.id,
      user_id: itemsTable.user_id,
      status: itemsTable.status,
      category: itemsTable.category,
      description: itemsTable.description,
    })
    .from(itemsTable)
    .where(eq(itemsTable.id, parsed.data.itemId))
    .get();

  if (!item) {
    return { message: "Item not found." };
  }

  if (item.user_id === user.id) {
    return { message: "You cannot claim your own item." };
  }

  if (!["found", "held_at_pickup", "claimed"].includes(item.status)) {
    return { message: "This item is not available for claims." };
  }

  // Check for existing claim
  const existingClaim = await db
    .select({
      id: claimsTable.id,
      status: claimsTable.status,
    })
    .from(claimsTable)
    .where(
      and(
        eq(claimsTable.item_id, item.id),
        eq(claimsTable.claimant_id, user.id),
        inArray(claimsTable.status, ["pending", "approved"])
      )
    )
    .get();

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

  try {
    const claimId = `claim_${randomUUID()}`;
    await db.insert(claimsTable).values({
      id: claimId,
      item_id: item.id,
      claimant_id: user.id,
      proof_description: enrichedProof || null,
      status: "pending",
    });
  } catch (err) {
    console.error("Error creating claim:", err);
    return { message: "Failed to submit claim. Please try again." };
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

  const db = initializeDatabase();

  // Get claim from Turso
  const claim = await db
    .select({
      id: claimsTable.id,
      item_id: claimsTable.item_id,
      claimant_id: claimsTable.claimant_id,
      status: claimsTable.status,
    })
    .from(claimsTable)
    .where(eq(claimsTable.id, parsed.data.claimId))
    .get();

  if (!claim) {
    return { message: "Claim not found." };
  }

  if (claim.status !== "pending") {
    return { message: "Only pending claims can be reviewed." };
  }

  // Get item from Turso
  const item = await db
    .select({
      id: itemsTable.id,
      user_id: itemsTable.user_id,
      title: itemsTable.title,
    })
    .from(itemsTable)
    .where(eq(itemsTable.id, claim.item_id))
    .get();

  if (!item) {
    return { message: "Item attached to this claim was not found." };
  }

  if (item.user_id !== user.id) {
    return { message: "Only the item owner can review claims." };
  }

  try {
    // Update claim status in Turso
    await db
      .update(claimsTable)
      .set({ status: parsed.data.decision })
      .where(eq(claimsTable.id, claim.id));

    if (parsed.data.decision === "approved") {
      // Update item status to claimed in Turso
      await db
        .update(itemsTable)
        .set({ status: "claimed" })
        .where(eq(itemsTable.id, item.id));

      // Get claimant profile for notification
      const claimantProfile = await db
        .select({ email: profiles.email })
        .from(profiles)
        .where(eq(profiles.id, claim.claimant_id))
        .get();

      await notifyStatusChange({
        supabase,
        userId: claim.claimant_id,
        email: claimantProfile?.email,
        itemTitle: item.title,
        newStatus: "claimed",
      });
    }
  } catch (err) {
    console.error("Error reviewing claim:", err);
    return { message: "Failed to review claim. Please try again." };
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