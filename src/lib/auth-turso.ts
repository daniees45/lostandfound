import { initializeDatabase } from "./db";
import { profiles } from "./schema";
import { eq } from "drizzle-orm";

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
