import { redirect } from "next/navigation";
import { PickupManager } from "@/components/pickup-manager";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { initializeDatabase } from "@/lib/db";
import { claims as claimsTable, items as itemsTable, profiles } from "@/lib/schema";

type HeldPickupItem = {
  id: string;
  title: string;
  location: string;
  created_at?: string;
  approvedClaim:
    | {
        claimantId: string;
        claimantName: string;
        claimantEmail: string;
        proofDescription?: string | null;
      }
    | null;
};

export default async function PickupPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/login");
  }

  const db = initializeDatabase();

  const profile = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .get();

  if (profile?.role !== "pickup_point" && profile?.role !== "admin") {
    redirect("/dashboard");
  }

  const heldItemsData = await db
    .select({
      id: itemsTable.id,
      title: itemsTable.title,
      location: itemsTable.location,
      created_at: itemsTable.created_at,
    })
    .from(itemsTable)
    .where(eq(itemsTable.status, "held_at_pickup"))
    .orderBy(desc(itemsTable.created_at))
    .limit(50);

  const heldItems = (heldItemsData ?? []).map((item) => ({
    ...item,
    created_at: item.created_at?.toISOString(),
  }));

  const itemIds = heldItems.map((item) => item.id);
  const approvedClaimsData = itemIds.length
    ? await db
        .select({
          item_id: claimsTable.item_id,
          claimant_id: claimsTable.claimant_id,
          proof_description: claimsTable.proof_description,
        })
        .from(claimsTable)
        .where(and(inArray(claimsTable.item_id, itemIds), eq(claimsTable.status, "approved")))
    : [];

  const approvedClaims = approvedClaimsData ?? [];
  const claimantIds = [...new Set(approvedClaims.map((claim) => claim.claimant_id))];

  const claimantProfilesData = claimantIds.length
    ? await db
        .select({
          id: profiles.id,
          full_name: profiles.full_name,
          email: profiles.email,
        })
        .from(profiles)
        .where(inArray(profiles.id, claimantIds))
    : [];

  const claimantProfiles = new Map(
    (claimantProfilesData ?? []).map((profile) => [
      profile.id,
      {
        fullName: profile.full_name ?? "Approved claimant",
        email: profile.email ?? "No email on file",
      },
    ])
  );

  const approvedClaimByItem = new Map(
    approvedClaims.map((claim) => [
      claim.item_id as string,
      {
        claimantId: claim.claimant_id,
        claimantName: claimantProfiles.get(claim.claimant_id)?.fullName ?? "Approved claimant",
        claimantEmail: claimantProfiles.get(claim.claimant_id)?.email ?? "No email on file",
        proofDescription: claim.proof_description ?? null,
      },
    ])
  );

  const preparedHeldItems: HeldPickupItem[] = heldItems.map((item) => ({
    ...item,
    approvedClaim: approvedClaimByItem.get(item.id) ?? null,
  }));

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Pickup Point Handover</h1>
      <p className="mt-2 text-sm text-sky-700 dark:text-sky-300">
        Staff can receive items into custody and complete the final return to an approved claimant.
      </p>

      <div className="mt-5">
        <PickupManager heldItems={preparedHeldItems} />
      </div>
    </div>
  );
}
