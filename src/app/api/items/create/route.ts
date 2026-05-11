import { NextResponse } from "next/server";
import { apiCreateItem } from "@/app/actions/items";

export async function POST(request: Request) {
  const formData = await request.formData();
  const result = await apiCreateItem(formData);
  return NextResponse.json(result);
}