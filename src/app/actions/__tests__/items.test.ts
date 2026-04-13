import { beforeEach, describe, expect, it, vi } from "vitest";

const createSupabaseServerClient = vi.fn();

vi.mock("@/lib/supabase-server", () => ({
  createSupabaseServerClient,
}));

vi.mock("@/lib/ai-tagging", () => ({
  suggestTagsAndCategory: vi.fn().mockResolvedValue({
    category: "Electronics",
    tags: ["Phone", "Black"],
  }),
}));

vi.mock("@/lib/embeddings", () => ({
  generateEmbedding: vi.fn().mockResolvedValue(null),
  toPgVectorLiteral: vi.fn((value) => value),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

describe("createItem", () => {
  beforeEach(() => {
    vi.resetModules();
    createSupabaseServerClient.mockReset();
  });

  it("rejects non-image uploads", async () => {
    const { createItem } = await import("@/app/actions/items");
    const formData = new FormData();
    formData.set("title", "Lost phone");
    formData.set("category", "Electronics");
    formData.set("description", "Black iPhone with a cracked corner and blue case.");
    formData.set("location", "Library");
    formData.set("date", "2026-03-24");
    formData.set("isFoundItem", "false");
    formData.set("image", new File(["notes"], "notes.txt", { type: "text/plain" }));

    const result = await createItem(undefined, formData);

    expect(result?.message).toBe("Uploaded file must be an image.");
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("requires an authenticated user before reporting", async () => {
    const { createItem } = await import("@/app/actions/items");
    createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    });

    const formData = new FormData();
    formData.set("title", "Lost wallet");
    formData.set("category", "Others");
    formData.set("description", "Brown wallet with student ID and transport card.");
    formData.set("location", "Lecture hall");
    formData.set("date", "2026-03-24");
    formData.set("isFoundItem", "false");

    const result = await createItem(undefined, formData);

    expect(result?.message).toBe("You must be signed in to report an item.");
  });
});