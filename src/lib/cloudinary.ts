const CLOUDINARY_BASE = "https://api.cloudinary.com/v1_1";

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

function getCloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    return null;
  }

  return { cloudName, uploadPreset };
}

export function cloudinaryReady() {
  return !!getCloudinaryConfig();
}

export function validateImageUpload(file: File, maxSizeBytes = MAX_IMAGE_SIZE_BYTES) {
  if (!file.type || !ALLOWED_IMAGE_TYPES.has(file.type)) {
    return "Supported formats: JPG, PNG, WEBP, GIF, HEIC, HEIF.";
  }

  if (file.size > maxSizeBytes) {
    const maxSizeMb = Math.floor(maxSizeBytes / (1024 * 1024));
    return `Image must be ${maxSizeMb}MB or smaller.`;
  }

  return null;
}

function sanitizeFolder(folder: string) {
  return folder
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/[^a-zA-Z0-9/_-]/g, "");
}

export async function uploadImageToCloudinary(
  file: File,
  folder = "lost-found-system/items"
): Promise<string> {
  const config = getCloudinaryConfig();
  if (!config) {
    throw new Error("Cloudinary is not configured.");
  }

  const validationMessage = validateImageUpload(file);
  if (validationMessage) {
    throw new Error(validationMessage);
  }

  const safeFolder = sanitizeFolder(folder) || "lost-found-system/items";
  const fileBlob = new Blob([await file.arrayBuffer()], { type: file.type });
  const uploadName = file.name?.trim() || "upload-image";

  const body = new FormData();
  body.set("file", fileBlob, uploadName);
  body.set("upload_preset", config.uploadPreset);
  body.set("folder", safeFolder);
  body.set("resource_type", "image");
  body.set("use_filename", "true");
  body.set("unique_filename", "true");
  body.set("overwrite", "false");
  body.set("fetch_format", "auto");
  body.set("quality", "auto");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  let response: Response | null = null;
  try {
    response = await fetch(`${CLOUDINARY_BASE}/${config.cloudName}/image/upload`, {
      method: "POST",
      body,
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Cloudinary upload timed out. Please try again.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response) {
    throw new Error("Cloudinary upload failed before a response was received.");
  }

  if (!response.ok) {
    let reason = "unknown error";
    try {
      const errorPayload = (await response.json()) as {
        error?: { message?: string };
      };
      reason = errorPayload.error?.message || reason;
    } catch {
      reason = await response.text();
    }
    throw new Error(`Cloudinary upload failed: ${reason}`);
  }

  const payload = (await response.json()) as { secure_url?: string };
  if (!payload.secure_url) {
    throw new Error("Cloudinary response missing secure_url.");
  }

  return payload.secure_url;
}
