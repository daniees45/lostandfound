"use server";

import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { initializeDatabase } from "@/lib/db";
import { profiles, user_credentials } from "@/lib/schema";
import {
  clearAuthSession,
  ensureAuthTables,
  getCurrentUser,
  hashPassword,
  setAuthSession,
  upsertUserCredentials,
  verifyPassword,
} from "@/lib/auth";

const LoginSchema = z.object({
  email: z.email(),
  password: z.string().min(6),
});

const SignupSchema = z.object({
  fullName: z.string().min(2),
  email: z.email(),
  password: z.string().min(8),
});

const ForgotPasswordSchema = z.object({
  email: z.email(),
});

const ResetPasswordSchema = z.object({
  password: z.string().min(8),
  confirmPassword: z.string().min(8),
});

export type AuthState =
  | { errors?: Record<string, string[]>; message?: string }
  | undefined;

export async function login(
  _state: AuthState,
  formData: FormData
): Promise<AuthState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  try {
    await ensureAuthTables();
  } catch {
    return { message: "Could not initialize authentication. Please try again." };
  }

  const db = initializeDatabase();
  const record = await db
    .select({
      id: profiles.id,
      email: profiles.email,
      password_hash: user_credentials.password_hash,
    })
    .from(profiles)
    .innerJoin(user_credentials, eq(profiles.id, user_credentials.user_id))
    .where(eq(profiles.email, parsed.data.email.toLowerCase()))
    .get();

  if (!record?.id || !record.email || !verifyPassword(parsed.data.password, record.password_hash)) {
    return { message: "Invalid email or password." };
  }

  await setAuthSession(record.id, record.email);

  const redirectTo = (formData.get("redirectTo") as string) || "/dashboard";
  redirect(redirectTo);
}

export async function signup(
  _state: AuthState,
  formData: FormData
): Promise<AuthState> {
  const parsed = SignupSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { fullName, email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  try {
    await ensureAuthTables();
    const db = initializeDatabase();

    const existing = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.email, normalizedEmail))
      .get();

    if (existing?.id) {
      return { message: "An account with this email already exists." };
    }

    const userId = `usr_${randomUUID()}`;
    await db.insert(profiles).values({
      id: userId,
      role: "student",
      email: normalizedEmail,
      full_name: fullName,
    });

    await upsertUserCredentials(userId, hashPassword(password));
    await setAuthSession(userId, normalizedEmail);
  } catch (error) {
    console.error("Error creating account:", error);
    return { message: "Could not create account. Please try again." };
  }

  redirect("/dashboard");
}

export async function requestPasswordReset(
  _state: AuthState,
  formData: FormData
): Promise<AuthState> {
  const parsed = ForgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  return {
    message:
      "Password reset by email is disabled in Turso-only mode. Sign in and update your password from the reset page.",
  };
}

export async function updatePassword(
  _state: AuthState,
  formData: FormData
): Promise<AuthState> {
  const parsed = ResetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  if (parsed.data.password !== parsed.data.confirmPassword) {
    return {
      errors: {
        confirmPassword: ["Passwords do not match."],
      },
    };
  }

  const user = await getCurrentUser();

  if (!user) {
    return {
      message: "You must be signed in to update your password.",
    };
  }

  const db = initializeDatabase();
  const profile = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(and(eq(profiles.id, user.id), eq(profiles.email, user.email)))
    .get();

  if (!profile?.id) {
    return { message: "Account not found." };
  }

  await upsertUserCredentials(profile.id, hashPassword(parsed.data.password));

  redirect("/auth/login?message=Password+updated.+Please+sign+in");
}

export async function signOut() {
  await clearAuthSession();
  redirect("/auth/login");
}
