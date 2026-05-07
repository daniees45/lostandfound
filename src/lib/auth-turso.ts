import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { initializeDatabase } from "./db";
import { profiles } from "./schema";
import { eq } from "drizzle-orm";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll called from a Server Component. Middleware handles refresh.
          }
        },
      },
    }
  );
}

export async function createUserProfile(userId: string, email: string | null, fullName: string | null) {
  const db = initializeDatabase();
  
  try {
    await db
      .insert(profiles)
      .values({
        id: userId,
        role: "student",
        email: email,
        full_name: fullName,
      })
      .onConflictDoUpdate({
        target: profiles.id,
        set: {
          email: email,
          full_name: fullName,
        },
      });
  } catch (error) {
    console.error("Error creating/updating user profile:", error);
    throw error;
  }
}

export async function getUserProfile(userId: string) {
  const db = initializeDatabase();
  
  const profile = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, userId))
    .get();
  
  return profile;
}
