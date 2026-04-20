"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { z } from "zod";

const LoginSchema = z.object({
  email: z.email(),
  password: z.string().min(6),
});

const SignupSchema = z.object({
  fullName: z.string().min(2),
  email: z.email(),
  password: z.string().min(8),
});

export type AuthState =
  | { errors?: Record<string, string[]>; message?: string }
  | undefined;

export async function login(
  _state: AuthState,
  formData: FormData
): Promise<AuthState> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return {
      message:
        "Authentication service is not configured. Please contact the administrator.",
    };
  }

  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    return { message: "Could not connect to authentication service. Please try again." };
  }

  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    if (
      error.message.includes("DOCTYPE") ||
      error.message.includes("not valid JSON") ||
      error.message.includes("Failed to fetch")
    ) {
      return {
        message:
          "Cannot reach the authentication server. Please try again later.",
      };
    }
    return { message: error.message };
  }

  if (!data.user || !data.session) {
    return { message: "Sign-in failed. Please confirm your email or check your credentials." };
  }

  // Best-effort profile upsert — do not block sign-in if it fails
  const profileRole = (
    typeof data.user.user_metadata?.role === "string" &&
    ["student", "admin", "pickup_point"].includes(data.user.user_metadata.role)
      ? data.user.user_metadata.role
      : "student"
  ) as "student" | "admin" | "pickup_point";

  await supabase.from("profiles").upsert({
    id: data.user.id,
    full_name:
      (typeof data.user.user_metadata?.full_name === "string" &&
        data.user.user_metadata.full_name) ||
      null,
    email: data.user.email ?? null,
    role: profileRole,
  });

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
  const role = "student" as const;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, role } },
  });

  if (error) {
    return { message: error.message };
  }

  // Insert public profile row if user was created immediately
  if (data.user) {
    const { error: profileError } = await supabase.from("profiles").upsert({
      id: data.user.id,
      full_name: fullName,
      email,
      role,
    });

    if (profileError) {
      return {
        message:
          "Account created, but profile setup failed. Please sign in again to complete setup.",
      };
    }
  }

  redirect("/auth/login?message=Check+your+email+to+confirm+your+account");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/auth/login");
}
