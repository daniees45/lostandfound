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

vi.mock("@/lib/notifications", () => ({
  notifyStatusChange,
}));

describe("pickup actions", () => {
  beforeEach(() => {
    vi.resetModules();
    createSupabaseServerClient.mockReset();
    revalidatePath.mockReset();
    notifyStatusChange.mockReset();
  });

  it("requires notes for manual override release", async () => {
    const { releaseHeldItem } = await import("@/app/actions/pickup");
    const formData = new FormData();
    formData.set("itemId", "7a4c7651-640e-4bf7-a64f-4d50738ad406");
    formData.set("claimantId", "d8f2137b-4967-4c79-b58d-1ce0730c2c65");
    formData.set("verificationMethod", "manual_override");

    const result = await releaseHeldItem(undefined, formData);

    expect(result?.errors?.notes?.[0]).toBe("Notes are required for manual override.");
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("requires an authenticated user before verifying pickup codes", async () => {
    const { verifyPickupCode } = await import("@/app/actions/pickup");
    createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    });

    const formData = new FormData();
    formData.set("handoverCode", "123456");

    const result = await verifyPickupCode(undefined, formData);

    expect(result?.message).toBe("You must be signed in to verify a code.");
  });

  it("requires an authenticated user before releasing held items", async () => {
    const { releaseHeldItem } = await import("@/app/actions/pickup");
    createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    });

    const formData = new FormData();
    formData.set("itemId", "7a4c7651-640e-4bf7-a64f-4d50738ad406");
    formData.set("claimantId", "d8f2137b-4967-4c79-b58d-1ce0730c2c65");
    formData.set("verificationMethod", "id_card");

    const result = await releaseHeldItem(undefined, formData);

    expect(result?.message).toBe("You must be signed in to release an item.");
  });

  it("releases a held item to approved claimant and marks returned", async () => {
    const roleBuilder = {
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { role: "pickup_point" } }),
    };

    const itemBuilder = {
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: "item-1", user_id: "owner-1", title: "Laptop", status: "held_at_pickup" },
        error: null,
      }),
    };

    const claimBuilder = {
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: "claim-1", claimant_id: "claimer-1" },
        error: null,
      }),
    };

    const profileListBuilder = {
      in: vi.fn().mockResolvedValue({
        data: [
          { id: "owner-1", email: "owner@example.com" },
          { id: "claimer-1", email: "claimer@example.com" },
        ],
      }),
    };

    const itemUpdateEq = vi.fn().mockResolvedValue({ error: null });
    const custodyInsert = vi.fn().mockResolvedValue({ error: null });

    createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "staff-1" } } }),
      },
      from: vi.fn((table: string) => {
        if (table === "profiles") {
          const select = vi.fn((columns: string) => {
            if (columns === "role") return roleBuilder;
            return profileListBuilder;
          });
          return { select };
        }

        if (table === "items") {
          return {
            select: vi.fn(() => itemBuilder),
            update: vi.fn(() => ({ eq: itemUpdateEq })),
          };
        }

        if (table === "claims") {
          return {
            select: vi.fn(() => claimBuilder),
          };
        }

        if (table === "custody_logs") {
          return {
            insert: custodyInsert,
          };
        }

        throw new Error(`Unexpected table in test: ${table}`);
      }),
    });

    const { releaseHeldItem } = await import("@/app/actions/pickup");
    const formData = new FormData();
    formData.set("itemId", "7a4c7651-640e-4bf7-a64f-4d50738ad406");
    formData.set("claimantId", "d8f2137b-4967-4c79-b58d-1ce0730c2c65");
    formData.set("verificationMethod", "id_card");
    formData.set("notes", "Student ID matched to approved claim.");

    const result = await releaseHeldItem(undefined, formData);

    expect(result?.success).toBe(true);
    expect(itemUpdateEq).toHaveBeenCalledWith("id", "item-1");
    expect(custodyInsert).toHaveBeenCalledTimes(1);
    expect(notifyStatusChange).toHaveBeenCalledTimes(2);
    expect(revalidatePath).toHaveBeenCalledWith("/pickup");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(revalidatePath).toHaveBeenCalledWith("/items");
  });
});