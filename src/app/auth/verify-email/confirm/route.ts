import { NextResponse } from "next/server";
import { consumeEmailVerificationToken } from "@/lib/email-verification";
import { initializeDatabase } from "@/lib/db";
import { profiles } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { sendEmail, buildWelcomeEmail } from "@/lib/email";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(
      `${origin}/auth/verify-email?message=Missing+verification+token.&success=0`
    );
  }

  const result = await consumeEmailVerificationToken(token);

  if (!result.ok) {
    const reasonMessage =
      result.reason === "expired"
        ? "Verification+link+expired.+Request+a+new+one."
        : "Invalid+verification+link.+Request+a+new+one.";
    return NextResponse.redirect(
      `${origin}/auth/verify-email?message=${reasonMessage}&success=0`
    );
  }

  try {
    const db = initializeDatabase();
    const profile = await db
      .select({ full_name: profiles.full_name, email: profiles.email })
      .from(profiles)
      .where(eq(profiles.id, result.userId))
      .get();

    if (profile?.email) {
      const loginUrl = `${origin}/auth/login`;
      const welcome = buildWelcomeEmail(profile.full_name ?? "there", loginUrl);
      await sendEmail({ to: profile.email, ...welcome });
    }
  } catch (error) {
    console.error("Post-verification welcome email failed:", error);
  }

  return NextResponse.redirect(
    `${origin}/auth/login?message=Email+verified.+You+can+now+sign+in.&success=1`
  );
}
