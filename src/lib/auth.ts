import { randomUUID, createHmac, timingSafeEqual, scryptSync } from "crypto";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { initializeDatabase } from "@/lib/db";
import { profiles, user_credentials } from "@/lib/schema";

const AUTH_COOKIE_NAME = "lf_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;

type SessionPayload = {
  uid: string;
  email: string;
  exp: number;
};

export type AuthUser = {
  id: string;
  email: string;
  user_metadata?: {
    full_name?: string | null;
  };
};

function getSessionSecret() {
  return process.env.AUTH_SESSION_SECRET || process.env.TURSO_AUTH_TOKEN || "dev-session-secret";
}

function encodeBase64Url(input: string) {
  return Buffer.from(input, "utf8").toString("base64url");
}

function decodeBase64Url(input: string) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function signPayload(payload: string) {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

export function createSessionToken(userId: string, email: string) {
  const payload: SessionPayload = {
    uid: userId,
    email,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const [payloadPart, sigPart] = token.split(".");
  if (!payloadPart || !sigPart) return null;

  const expectedSig = signPayload(payloadPart);
  const provided = Buffer.from(sigPart);
  const expected = Buffer.from(expectedSig);
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;

  try {
    const payload = JSON.parse(decodeBase64Url(payloadPart)) as SessionPayload;
    if (!payload.uid || !payload.email || typeof payload.exp !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function setAuthSession(userId: string, email: string) {
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, createSessionToken(userId, email), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearAuthSession() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);
  if (!session) return null;

  const db = initializeDatabase();
  const profile = await db
    .select({
      id: profiles.id,
      email: profiles.email,
      full_name: profiles.full_name,
    })
    .from(profiles)
    .where(and(eq(profiles.id, session.uid), eq(profiles.email, session.email)))
    .get();

  if (!profile?.id || !profile.email) return null;
  return {
    id: profile.id,
    email: profile.email,
    user_metadata: {
      full_name: profile.full_name,
    },
  };
}

export function hashPassword(password: string) {
  const salt = randomUUID();
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string | null | undefined) {
  if (!storedHash || !storedHash.includes(":")) return false;
  const [salt, existingHash] = storedHash.split(":");
  if (!salt || !existingHash) return false;
  const hash = scryptSync(password, salt, 64).toString("hex");
  const provided = Buffer.from(hash, "hex");
  const expected = Buffer.from(existingHash, "hex");
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

export async function ensureAuthTables() {
  const db = initializeDatabase();
  await db.run(`
    CREATE TABLE IF NOT EXISTS user_credentials (
      user_id TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
    )
  `);
  await db.run(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
    )
  `);
  await db.run(`
    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
    )
  `);

  const columns = await db.run(`PRAGMA table_info(profiles)`);
  const existing = new Set(
    ((columns.rows ?? []) as Array<Record<string, unknown>>)
      .map((row) => String(row.name ?? ""))
      .filter(Boolean)
  );

  if (!existing.has("email_verified")) {
    await db.run(
      `ALTER TABLE profiles ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0`
    );
  }

  if (!existing.has("email_verified_at")) {
    await db.run(`ALTER TABLE profiles ADD COLUMN email_verified_at INTEGER`);
  }
}

export async function upsertUserCredentials(userId: string, passwordHash: string) {
  await ensureAuthTables();
  const db = initializeDatabase();
  await db
    .insert(user_credentials)
    .values({
      user_id: userId,
      password_hash: passwordHash,
      updated_at: new Date(),
    })
    .onConflictDoUpdate({
      target: user_credentials.user_id,
      set: {
        password_hash: passwordHash,
        updated_at: new Date(),
      },
    });
}