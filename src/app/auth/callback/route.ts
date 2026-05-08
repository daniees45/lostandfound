import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const next = searchParams.get("next") ?? "/dashboard";

  return NextResponse.redirect(
    `${origin}${next}?message=Turso+mode+enabled.+Sign+in+with+email+and+password.&success=1`
  );
}
