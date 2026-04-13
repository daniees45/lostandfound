export type UserRole = "student" | "admin" | "pickup_point";

export type ItemStatus =
  | "lost"
  | "found"
  | "claimed"
  | "returned"
  | "held_at_pickup";

export interface Item {
  id: string;
  user_id?: string;
  title: string;
  description: string;
  category: string;
  ai_tags?: string[];
  location: string;
  status: ItemStatus;
  created_at?: string;
  image_url?: string | null;
}

export interface Claim {
  id: string;
  item_id: string;
  claimant_id: string;
  proof_description?: string;
  status: "pending" | "approved" | "rejected";
}
