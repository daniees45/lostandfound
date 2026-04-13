import { Item } from "@/lib/types";

export const mockItems: Item[] = [
  {
    id: "1",
    title: "Black Backpack",
    description: "Black Jansport bag with a physics notebook inside.",
    category: "Bags",
    location: "Science Block",
    status: "found",
    created_at: "2026-03-20",
  },
  {
    id: "2",
    title: "iPhone 13",
    description: "Blue iPhone 13 with transparent case.",
    category: "Electronics",
    location: "Main Library",
    status: "held_at_pickup",
    created_at: "2026-03-22",
  },
  {
    id: "3",
    title: "Student ID Card",
    description: "Valley View University ID card, name starts with A.",
    category: "Documents",
    location: "Cafeteria",
    status: "found",
    created_at: "2026-03-23",
  },
];
