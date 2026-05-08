const CLOUDINARY_BASE = "https://api.cloudinary.com/v1_1";

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

export async function uploadImageToCloudinary(
  file: File,
  folder = "lost-found-system/items"
): Promise<string> {
  const config = getCloudinaryConfig();
  if (!config) {
    throw new Error("Cloudinary is not configured.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const dataUri = `data:${file.type};base64,${bytes.toString("base64")}`;

  const body = new FormData();
  body.set("file", dataUri);
  body.set("upload_preset", config.uploadPreset);
  body.set("folder", folder);

  const response = await fetch(
    `${CLOUDINARY_BASE}/${config.cloudName}/image/upload`,
    {
      method: "POST",
      body,
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cloudinary upload failed: ${errorText}`);
  }

  const payload = (await response.json()) as { secure_url?: string };
  if (!payload.secure_url) {
    throw new Error("Cloudinary response missing secure_url.");
  }

  return payload.secure_url;
}
