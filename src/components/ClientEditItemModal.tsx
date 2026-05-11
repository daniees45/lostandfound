"use client";

import dynamic from "next/dynamic";

const EditItemModal = dynamic(() => import("@/components/edit-item-modal"), {
  ssr: false,
});

export default EditItemModal;