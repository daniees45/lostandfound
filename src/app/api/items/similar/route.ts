import { NextResponse } from "next/server";
import { apiCheckForSimilarItems } from "@/app/actions/items";

export async function POST(request: Request) {
  const input = await request.json();
  const result = await apiCheckForSimilarItems(input);
  return NextResponse.json(result);
}