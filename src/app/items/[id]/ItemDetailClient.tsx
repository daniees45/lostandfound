"use client";

import { useState } from "react";
import ClientEditItemModal from "@/components/ClientEditItemModal";
import { Item } from "@/lib/types";

export default function ItemDetailClient({ item }: { item: Item }) {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <div>
      <button onClick={() => setEditOpen(true)}>Edit Item</button>
      {editOpen && (
        <ClientEditItemModal
          item={item}
          isOpen={editOpen}
          onClose={() => setEditOpen(false)}
          onSuccess={() => alert("Item updated successfully!")}
        />
      )}
    </div>
  );
}