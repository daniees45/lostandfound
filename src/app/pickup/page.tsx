import { redirect } from "next/navigation";
import { PickupManager } from "@/components/pickup-manager";
import { createSupabaseServerClient } from "@/lib/supabase-server";

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
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "pickup_point" && profile?.role !== "admin") {
    redirect("/dashboard");
  }

  const { data: heldItemsData } = await supabase
    .from("items")
    .select("id, title, location, created_at")
    .eq("status", "held_at_pickup")
    .order("created_at", { ascending: false })
    .limit(50);

  const heldItems = (heldItemsData ?? []) as Array<{
    id: string;
    title: string;
    location: string;
    created_at?: string;
  }>;

  const itemIds = heldItems.map((item) => item.id);
  const { data: approvedClaimsData } = itemIds.length
    ? await supabase
        .from("claims")
        .select("item_id, claimant_id, proof_description")
        .in("item_id", itemIds)
        .eq("status", "approved")
    : { data: [] as Array<{ item_id: string; claimant_id: string; proof_description?: string | null }> };

  const approvedClaims = approvedClaimsData ?? [];
  const claimantIds = [...new Set(approvedClaims.map((claim) => claim.claimant_id))];

  const { data: claimantProfilesData } = claimantIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", claimantIds)
    : { data: [] as Array<{ id: string; full_name?: string | null; email?: string | null }> };

  const claimantProfiles = new Map(
    (claimantProfilesData ?? []).map((profile) => [
      profile.id as string,
      {
        fullName: (profile.full_name as string | null) ?? "Approved claimant",
        email: (profile.email as string | null) ?? "No email on file",
      },
    ])
  );

  const approvedClaimByItem = new Map(
    approvedClaims.map((claim) => [
      claim.item_id as string,
      {
        claimantId: claim.claimant_id as string,
        claimantName: claimantProfiles.get(claim.claimant_id as string)?.fullName ?? "Approved claimant",
        claimantEmail: claimantProfiles.get(claim.claimant_id as string)?.email ?? "No email on file",
        proofDescription: (claim.proof_description as string | null) ?? null,
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
