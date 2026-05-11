import { createHash, randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { initializeDatabase } from "@/lib/db";
import { email_verification_tokens, profiles } from "@/lib/schema";

const EMAIL_VERIFICATION_TTL_MS = 1000 * 60 * 60 * 24;

export async function issueEmailVerificationToken(userId: string) {
  const db = initializeDatabase();
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);

  await db
    .delete(email_verification_tokens)
    .where(eq(email_verification_tokens.user_id, userId));

  await db.insert(email_verification_tokens).values({
    token_hash: tokenHash,
    user_id: userId,
    expires_at: expiresAt,
  });

  return token;
}

export async function consumeEmailVerificationToken(token: string) {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const db = initializeDatabase();

  const record = await db
    .select()
    .from(email_verification_tokens)
    .where(eq(email_verification_tokens.token_hash, tokenHash))
    .get();

  if (!record) {
    return { ok: false as const, reason: "invalid" as const };
  }

  if (record.expires_at < new Date()) {
    await db
      .delete(email_verification_tokens)
      .where(eq(email_verification_tokens.token_hash, tokenHash));
    return { ok: false as const, reason: "expired" as const };
  }

  await db
    .update(profiles)
    .set({
      email_verified: true,
      email_verified_at: new Date(),
    })
    .where(eq(profiles.id, record.user_id));

  await db
    .delete(email_verification_tokens)
    .where(eq(email_verification_tokens.user_id, record.user_id));

  return { ok: true as const, userId: record.user_id };
}
