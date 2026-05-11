// Add ReportSchema definition for createItem
const ReportSchema = z.object({
  title: z.string().min(2),
  category: z.string().min(1),
  description: z.string().min(10),
  location: z.string().min(2),
  date: z.string().min(1),
  status: z.enum(["lost", "found"]),
});
import { redirect } from "next/navigation";
import { initializeDatabase } from "@/lib/db";
import { items as itemsTable, chat_rooms, chat_messages } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth";
import { createUserProfile } from "@/lib/auth-turso";
import {
  cloudinaryReady,
  uploadImageToCloudinary,
  validateImageUpload,
} from "@/lib/cloudinary";
import { suggestTagsAndCategory } from "@/lib/ai-tagging";
import { generateEmbedding } from "@/lib/embeddings";
import {
  normalizeMultilingualReport,
  generateItemSummary,
} from "@/lib/ai-service-client";
import { z } from "zod";
import { inArray, eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";

// Helper to get chat room id for an item
function getRoomId(itemId: string) {
  return `room_item_${itemId}`;
}

const UpdateOwnItemSchema = z.object({
  itemId: z.string(),
  title: z.string().min(2),
  category: z.string().min(1),
  description: z.string().min(10),
  location: z.string().min(2),
  status: z.enum(["lost", "found", "claimed", "returned", "held_at_pickup"]),
});

export async function updateOwnItem(
  _state: ReportState,
  formData: FormData
): Promise<ReportState> {
  const parsed = UpdateOwnItemSchema.safeParse({
    itemId: formData.get("itemId"),
    title: formData.get("title"),
    category: formData.get("category"),
    description: formData.get("description"),
    location: formData.get("location"),
    status: formData.get("status"),
  });

  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await getCurrentUser();
  if (!user) return { message: "You must be signed in to edit an item." };

  const db = initializeDatabase();
  // Fetch current item for comparison
  const item = await db
    .select({ user_id: itemsTable.user_id, status: itemsTable.status, title: itemsTable.title })
    .from(itemsTable)
    .where(eq(itemsTable.id, parsed.data.itemId))
    .get();
  if (!item) return { message: "Item not found." };
  if (item.user_id !== user.id) return { message: "You can only edit your own items." };

  let statusChanged = false;
  if (item.status !== parsed.data.status) {
    statusChanged = true;
  }

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

    // Post system message if status changed
    if (statusChanged) {
      const roomId = getRoomId(parsed.data.itemId);
      // Ensure chat room exists
      await db.insert(chat_rooms).values({
        id: roomId,
        item_id: parsed.data.itemId,
        created_by: user.id,
      }).onConflictDoNothing();
      // Insert system message
      await db.insert(chat_messages).values({
        id: `sysmsg_${randomUUID()}`,
        room_id: roomId,
        sender_id: user.id, // Could use a special system user if desired
        body: `System: Status changed to '${parsed.data.status}' for item '${item.title}'.`,
        referenced_item_id: parsed.data.itemId,
        created_at: new Date(),
      });
    }
  } catch (err) {
    console.error("Error updating item:", err);
    return { message: "Failed to update item." };
  }

  return { message: "Item updated successfully." };
}


export type ReportState =
  | { errors?: Record<string, string[]>; message?: string }
  | undefined;

function generatePickupCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
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
    const validationError = validateImageUpload(imageFile);
    if (validationError) {
      return { message: validationError };
    }

    uploadedImage = imageFile;
  }

  const user = await getCurrentUser();

  if (!user) {
    return { message: "You must be signed in to report an item." };
  }

  // Create/update user profile in Turso
  try {
    await createUserProfile(user.id, user.email ?? null, user.user_metadata?.full_name ?? null);
  } catch (err) {
    console.error("Error creating user profile:", err);
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
  const visionTags: string[] = [];
  const visionCategory: string | null = null;

  if (uploadedImage) {
    if (!cloudinaryReady()) {
      return {
        message:
          "Image upload is unavailable until Cloudinary is configured (prefer CLOUDINARY_URL, or CLOUDINARY_CLOUD_NAME + CLOUDINARY_UPLOAD_PRESET).",
      };
    }

    try {
      imageUrl = await uploadImageToCloudinary(uploadedImage);
    } catch (err) {
      console.error("Error uploading image to Cloudinary:", err);
      return { message: "Image upload failed. Please try another image." };
    }
  }

  const mergedTags = Array.from(new Set([...ai.tags, ...visionTags])).slice(0, 10);

  const db = initializeDatabase();

  try {
    const itemId = `item_${randomUUID()}`;
    await db.insert(itemsTable).values({
      id: itemId,
      user_id: user.id,
      title: normalizedTitle,
      category: visionCategory ?? ai.category,
      description: finalDescription,
      ai_tags: mergedTags,
      embedding: embedding,
      location: parsed.data.location,
      status: parsed.data.status,
      image_url: imageUrl,
      pickup_code: parsed.data.status === "found" ? generatePickupCode() : null,
      created_at: new Date(parsed.data.date),
    });
  } catch (err) {
    console.error("Error creating item:", err);
    return { message: "Failed to create item. Please try again." };
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

// Extracted server-side logic for `createItem` and `checkForSimilarItems`
export async function apiCreateItem(formData: FormData): Promise<ReportState> {
  return createItem(undefined, formData);
}

// ── Similar item lookup (used for duplicate warning on report page) ─────────
export async function checkForSimilarItems(input: {
  title: string;
  description: string;
  status: "lost" | "found";
}): Promise<Array<{ id: string; title: string; category: string; location: string; status: string }>> {
  if (!input.title || input.title.trim().length < 3) return [];

  const db = initializeDatabase();

  // Look for opposite-type items that might be a match
  const lostStatusArray = ["found", "held_at_pickup"] as const;
  const foundStatusArray = ["lost"] as const;
  const searchStatuses = input.status === "lost" ? lostStatusArray : foundStatusArray;

  const results = await db
    .select({ id: itemsTable.id, title: itemsTable.title, category: itemsTable.category, location: itemsTable.location, status: itemsTable.status })
    .from(itemsTable)
    .where(
      and(
        inArray(itemsTable.status, searchStatuses),
        eq(itemsTable.title, input.title),
        eq(itemsTable.description, input.description)
      )
    )
    .limit(5);

  return results; // Ensure the function always returns an array
}

// Ensure `apiCheckForSimilarItems` is exported
export async function apiCheckForSimilarItems(input: {
  title: string;
  description: string;
  status: "lost" | "found";
}): Promise<Array<{ id: string; title: string; category: string; location: string; status: string }>> {
  return checkForSimilarItems(input);
}

