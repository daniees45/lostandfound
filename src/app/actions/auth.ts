"use server";

import { redirect } from "next/navigation";
import { createHash, randomBytes, randomUUID } from "crypto";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { initializeDatabase } from "@/lib/db";
import {
  profiles,
  user_credentials,
  password_reset_tokens,
} from "@/lib/schema";
import {
  clearAuthSession,
  ensureAuthTables,
  hashPassword,
  setAuthSession,
  upsertUserCredentials,
  verifyPassword,
} from "@/lib/auth";
import {
  sendEmail,
  buildEmailVerificationEmail,
  buildPasswordResetEmail,
} from "@/lib/email";
import { issueEmailVerificationToken } from "@/lib/email-verification";
import {
  cloudinaryReady,
  uploadImageToCloudinary,
  validateImageUpload,
} from "@/lib/cloudinary";

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

const ResendVerificationSchema = z.object({
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
      email_verified: profiles.email_verified,
      password_hash: user_credentials.password_hash,
    })
    .from(profiles)
    .innerJoin(user_credentials, eq(profiles.id, user_credentials.user_id))
    .where(eq(profiles.email, parsed.data.email.toLowerCase()))
    .get();

  if (!record?.id || !record.email || !verifyPassword(parsed.data.password, record.password_hash)) {
    return { message: "Invalid email or password." };
  }

  if (!record.email_verified) {
    return {
      message:
        "Please verify your email before signing in. Use the resend verification option on this page.",
    };
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
  const avatarFile = formData.get("avatar");

  let avatarUrl: string | null = null;
  if (avatarFile instanceof File && avatarFile.size > 0) {
    const validationError = validateImageUpload(avatarFile);
    if (validationError) {
      return { message: validationError };
    }

    if (!cloudinaryReady()) {
      return {
        message:
          "Profile image upload requires Cloudinary setup (prefer CLOUDINARY_URL, or CLOUDINARY_CLOUD_NAME + CLOUDINARY_UPLOAD_PRESET).",
      };
    }

    try {
      avatarUrl = await uploadImageToCloudinary(avatarFile, "lost-found-system/avatars");
    } catch (error) {
      console.error("Signup avatar upload failed:", error);
      return { message: "Could not upload profile image. Please try another file." };
    }
  }

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
      email_verified: false,
      full_name: fullName,
      avatar_url: avatarUrl,
    });

    await upsertUserCredentials(userId, hashPassword(password));
    const verificationToken = await issueEmailVerificationToken(userId);

    const appUrl = process.env.APP_URL ?? "http://localhost:3000";
    const verifyUrl = `${appUrl}/auth/verify-email/confirm?token=${verificationToken}`;
    const verifyPayload = buildEmailVerificationEmail(verifyUrl);
    await sendEmail({ to: normalizedEmail, ...verifyPayload });
  } catch (error) {
    console.error("Error creating account:", error);
    return { message: "Could not create account. Please try again." };
  }

  redirect(
    "/auth/login?message=Account+created.+Check+your+email+to+verify+before+signing+in.&success=1"
  );
}

export async function requestPasswordReset(
  _state: AuthState,
  formData: FormData
): Promise<AuthState> {
  await ensureAuthTables();

  const parsed = ForgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const db = initializeDatabase();
  const user = await db
    .select({
      id: profiles.id,
      email: profiles.email,
      email_verified: profiles.email_verified,
    })
    .from(profiles)
    .where(eq(profiles.email, parsed.data.email.toLowerCase()))
    .get();

  // Always return the same message to prevent user enumeration
  if (user?.id && user.email && user.email_verified) {
    // Delete any existing tokens for this user
    await db
      .delete(password_reset_tokens)
      .where(eq(password_reset_tokens.user_id, user.id));

    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.insert(password_reset_tokens).values({
      token_hash: tokenHash,
      user_id: user.id,
      expires_at: expiresAt,
    });

    const appUrl = process.env.APP_URL ?? "http://localhost:3000";
    const resetUrl = `${appUrl}/auth/reset-password?token=${token}`;
    const emailPayload = buildPasswordResetEmail(resetUrl);
    await sendEmail({ to: user.email, ...emailPayload });
  } else if (user?.id && user.email && !user.email_verified) {
    const verificationToken = await issueEmailVerificationToken(user.id);
    const appUrl = process.env.APP_URL ?? "http://localhost:3000";
    const verifyUrl = `${appUrl}/auth/verify-email/confirm?token=${verificationToken}`;
    const verifyPayload = buildEmailVerificationEmail(verifyUrl);
    await sendEmail({ to: user.email, ...verifyPayload });
  }

  return {
    message:
      "If an account with that email exists, a reset link has been sent. Check your inbox.",
  };
}

export async function resendVerificationEmail(
  _state: AuthState,
  formData: FormData
): Promise<AuthState> {
  await ensureAuthTables();

  const parsed = ResendVerificationSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const normalizedEmail = parsed.data.email.toLowerCase();
  const db = initializeDatabase();
  const user = await db
    .select({
      id: profiles.id,
      email: profiles.email,
      email_verified: profiles.email_verified,
    })
    .from(profiles)
    .where(eq(profiles.email, normalizedEmail))
    .get();

  if (user?.id && user.email && !user.email_verified) {
    const verificationToken = await issueEmailVerificationToken(user.id);
    const appUrl = process.env.APP_URL ?? "http://localhost:3000";
    const verifyUrl = `${appUrl}/auth/verify-email/confirm?token=${verificationToken}`;
    const verifyPayload = buildEmailVerificationEmail(verifyUrl);
    await sendEmail({ to: user.email, ...verifyPayload });
  }

  return {
    message:
      "If this account exists and is not yet verified, a verification email has been sent.",
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

  const token = formData.get("token") as string | null;
  if (!token) {
    return {
      message:
        "Missing reset token. Please request a new password reset link.",
    };
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const db = initializeDatabase();
  const record = await db
    .select()
    .from(password_reset_tokens)
    .where(eq(password_reset_tokens.token_hash, tokenHash))
    .get();

  if (!record) {
    return {
      message: "Invalid or expired reset link. Please request a new one.",
    };
  }

  if (record.expires_at < new Date()) {
    await db
      .delete(password_reset_tokens)
      .where(eq(password_reset_tokens.token_hash, tokenHash));
    return {
      message: "This reset link has expired. Please request a new one.",
    };
  }

  await upsertUserCredentials(record.user_id, hashPassword(parsed.data.password));
  await db
    .delete(password_reset_tokens)
    .where(eq(password_reset_tokens.token_hash, tokenHash));

  redirect("/auth/login?message=Password+updated.+Please+sign+in");
}

export async function signOut() {
  await clearAuthSession();
  redirect("/auth/login");
}
