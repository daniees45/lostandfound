import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { submitClaimAction } from "@/app/actions/claims";
import { getCurrentUser } from "@/lib/auth";
import { initializeDatabase } from "@/lib/db";
import { claims as claimsTable, items as itemsTable } from "@/lib/schema";
import { Item } from "@/lib/types";
import ItemDetailClient from "./ItemDetailClient";

function badgeClass(status: Item["status"]) {
  switch (status) {
    case "found":
      return "bg-emerald-100 text-emerald-800";
    case "held_at_pickup":
      return "bg-amber-100 text-amber-800";
    case "claimed":
      return "bg-blue-100 text-blue-800";
    case "returned":
      return "bg-zinc-200 text-zinc-800";
    default:
      return "bg-rose-100 text-rose-800";
  }
}

function formatDate(value?: string) {
  if (!value) return "Unknown";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const db = initializeDatabase();

  const item = await db
    .select()
    .from(itemsTable)
    .where(eq(itemsTable.id, id))
    .get();

  if (!item) {
    notFound();
  }

  // Adjust created_at to match the Item type
  const adjustedItem = {
    ...item,
    ai_tags: item.ai_tags ?? undefined, // Convert null to undefined
    created_at: item.created_at.toISOString(), // Convert Date to string
  };

  return <ItemDetailClient item={adjustedItem} currentUserId={user?.id} />;
}