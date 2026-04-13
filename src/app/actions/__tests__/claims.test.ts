import { beforeEach, describe, expect, it, vi } from "vitest";

const createSupabaseServerClient = vi.fn();
const revalidatePath = vi.fn();
const notifyStatusChange = vi.fn();

vi.mock("@/lib/supabase-server", () => ({
  createSupabaseServerClient,
}));

vi.mock("next/cache", () => ({
  revalidatePath,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/lib/notifications", () => ({
  notifyStatusChange,
}));

function maybeSingleBuilder(data: unknown, error: unknown = null) {
  return {
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  };
}

describe("reviewClaim", () => {
  beforeEach(() => {
    vi.resetModules();
    createSupabaseServerClient.mockReset();
    revalidatePath.mockReset();
    notifyStatusChange.mockReset();
  });

  it("approves a pending claim and marks item as claimed", async () => {
    const claimBuilder = maybeSingleBuilder({
      id: "claim-1",
      item_id: "item-1",
      claimant_id: "claimer-1",
      status: "pending",
    });

    const itemBuilder = maybeSingleBuilder({
      id: "item-1",
      user_id: "owner-1",
      title: "Black Backpack",
    });

    const claimantProfileBuilder = maybeSingleBuilder({
      email: "claimer@example.com",
    });

    const claimUpdateEq = vi.fn().mockResolvedValue({ error: null });
    const itemUpdateEq = vi.fn().mockResolvedValue({ error: null });

    const supabaseMock = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "owner-1" } } }),
      },
      from: vi.fn((table: string) => {
        if (table === "claims") {
          return {
            select: vi.fn(() => claimBuilder),
            update: vi.fn(() => ({ eq: claimUpdateEq })),
          };
        }

        if (table === "items") {
          return {
            select: vi.fn(() => itemBuilder),
            update: vi.fn(() => ({ eq: itemUpdateEq })),
          };
        }

        if (table === "profiles") {
          return {
            select: vi.fn(() => claimantProfileBuilder),
          };
        }

        throw new Error(`Unexpected table in test: ${table}`);
      }),
    };

    createSupabaseServerClient.mockResolvedValue(supabaseMock);

    const { reviewClaim } = await import("@/app/actions/claims");
    const formData = new FormData();
    formData.set("claimId", "7a4c7651-640e-4bf7-a64f-4d50738ad406");
    formData.set("decision", "approved");

    const result = await reviewClaim(undefined, formData);

    expect(result).toEqual({
      success: true,
      message: "Claim approved and item marked as claimed.",
    });

    expect(claimUpdateEq).toHaveBeenCalledWith("id", "claim-1");
    expect(itemUpdateEq).toHaveBeenCalledWith("id", "item-1");
    expect(notifyStatusChange).toHaveBeenCalledWith({
      supabase: supabaseMock,
      userId: "claimer-1",
      email: "claimer@example.com",
      itemTitle: "Black Backpack",
      newStatus: "claimed",
    });

    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(revalidatePath).toHaveBeenCalledWith("/items");
  });
});