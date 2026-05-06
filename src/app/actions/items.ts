"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { suggestTagsAndCategory } from "@/lib/ai-tagging";
import { generateEmbedding, toPgVectorLiteral } from "@/lib/embeddings";
import {
  normalizeMultilingualReport,
  generateItemSummary,
  extractTagsFromImageUrl,
} from "@/lib/ai-service-client";
import { z } from "zod";

const ITEM_IMAGE_BUCKET = "item-images";
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

const ReportSchema = z.object({
  title: z.string().min(2),
  category: z.string().min(1),
  description: z.string().min(10),
  location: z.string().min(2),
  date: z.string().min(1),
  status: z.enum(["lost", "found"]),
});

export type ReportState =
  | { errors?: Record<string, string[]>; message?: string }
  | undefined;

function generatePickupCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function normalizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-").toLowerCase();
}

export async function createItem(
  _state: ReportState,
  formData: FormData
): Promise<ReportState> {
  const parsed = ReportSchema.safeParse({
    title: formData.get("title"),
    category: formData.get("category"),
    description: formData.get("description"),
    location: formData.get("location"),
    date: formData.get("date"),
    status: formData.get("isFoundItem") === "true" ? "found" : "lost",
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const imageFile = formData.get("image");
  let uploadedImage: File | null = null;

  if (imageFile instanceof File && imageFile.size > 0) {
    if (!imageFile.type.startsWith("image/")) {
      return { message: "Uploaded file must be an image." };
    }

    if (imageFile.size > MAX_IMAGE_SIZE_BYTES) {
      return { message: "Image must be 5MB or smaller." };
    }

    uploadedImage = imageFile;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { message: "You must be signed in to report an item." };
  }

  const profileRole =
    (typeof user.user_metadata?.role === "string" &&
      ["student", "admin", "pickup_point"].includes(user.user_metadata.role)
      ? user.user_metadata.role
      : "student") as "student" | "admin" | "pickup_point";

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: user.id,
    full_name:
      (typeof user.user_metadata?.full_name === "string" &&
        user.user_metadata.full_name) ||
      null,
    email: user.email ?? null,
    role: profileRole,
  });

  if (profileError) {
    return {
      message:
        "Could not initialize your profile record. Please sign out and sign in again.",
    };
  }

  const normalized = await normalizeMultilingualReport({
    title: parsed.data.title,
    description: parsed.data.description,
    category: parsed.data.category,
    location: parsed.data.location,
  });

  const normalizedTitle = normalized?.title ?? parsed.data.title;
  const normalizedDescription = normalized?.description ?? parsed.data.description;

  const ai = await suggestTagsAndCategory({
    title: normalizedTitle,
    description: normalizedDescription,
    category: parsed.data.category,
  });

  const summary = await generateItemSummary({
    title: normalizedTitle,
    description: normalizedDescription,
    category: ai.category,
    location: parsed.data.location,
  });

  const finalDescription = summary?.summary
    ? `${normalizedDescription}\n\nSummary: ${summary.summary}`
    : normalizedDescription;

  const embeddingSource = `${normalizedTitle}\n${finalDescription}\n${ai.tags.join(" ")}`;
  const embedding = await generateEmbedding(embeddingSource);

  let imageUrl: string | null = null;
  let visionTags: string[] = [];
  let visionCategory: string | null = null;

  if (uploadedImage) {
    const extension = uploadedImage.name.includes(".")
      ? uploadedImage.name.split(".").pop()?.toLowerCase() ?? "jpg"
      : "jpg";
    const objectPath = `${user.id}/${crypto.randomUUID()}-${normalizeFileName(
      uploadedImage.name || `upload.${extension}`
    )}`;

    const { error: uploadError } = await supabase.storage
      .from(ITEM_IMAGE_BUCKET)
      .upload(objectPath, uploadedImage, {
        cacheControl: "3600",
        contentType: uploadedImage.type,
        upsert: false,
      });

    if (uploadError) {
      return {
        message:
          uploadError.message === "Bucket not found"
            ? "Image storage is not configured yet. Run the updated SQL schema first, then try again."
            : uploadError.message,
      };
    }

    const { data: publicImage } = supabase.storage.from(ITEM_IMAGE_BUCKET).getPublicUrl(objectPath);
    imageUrl = publicImage.publicUrl;

    const vision = await extractTagsFromImageUrl(imageUrl);
    if (Array.isArray(vision?.suggested_tags)) {
      visionTags = vision.suggested_tags.filter((tag: unknown) => typeof tag === "string") as string[];
    }
    if (typeof vision?.suggested_category === "string") {
      visionCategory = vision.suggested_category;
    }
  }

  const mergedTags = Array.from(new Set([...ai.tags, ...visionTags])).slice(0, 10);

  const { error } = await supabase.from("items").insert({
    user_id: user.id,
    title: normalizedTitle,
    category: visionCategory ?? ai.category,
    description: finalDescription,
    ai_tags: mergedTags,
    embedding: embedding ? toPgVectorLiteral(embedding) : null,
    location: parsed.data.location,
    status: parsed.data.status,
    image_url: imageUrl,
    pickup_code: parsed.data.status === "found" ? generatePickupCode() : null,
    created_at: parsed.data.date,
  });

  if (error) {
    return { message: error.message };
  }

  const reportMessage = encodeURIComponent(
    parsed.data.status === "found"
      ? "Found item posted successfully. It is now visible in browse items."
      : "Lost item posted successfully. View it in your dashboard reports."
  );

  if (parsed.data.status === "found") {
    redirect(`/items?reportSuccess=1&reportMessage=${reportMessage}`);
  }

  redirect(`/dashboard?reportSuccess=1&reportMessage=${reportMessage}`);
}

// ── Similar item lookup (used for duplicate warning on report page) ─────────
export async function checkForSimilarItems(input: {
  title: string;
  description: string;
  status: "lost" | "found";
}): Promise<Array<{ id: string; title: string; category: string; location: string; status: string }>> {
  if (!input.title || input.title.trim().length < 3) return [];

  const supabase = await createSupabaseServerClient();

  // Look for opposite-type items that might be a match
  const searchStatuses =
    input.status === "lost" ? ["found", "held_at_pickup"] : ["lost"];

  const keywords = input.title
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 4);

  if (keywords.length === 0) return [];

  const orFilter = keywords.map((k) => `title.ilike.%${k}%`).join(",");

  const { data } = await supabase
    .from("items")
    .select("id, title, category, location, status")
    .in("status", searchStatuses)
    .or(orFilter)
    .limit(4);

  return (data ?? []) as Array<{
    id: string;
    title: string;
    category: string;
    location: string;
    status: string;
  }>;
}
