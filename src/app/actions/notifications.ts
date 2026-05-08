"use server";

import { revalidatePath } from "next/cache";
import { initializeDatabase } from "@/lib/db";
import { notifications } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

export async function markNotificationRead(formData: FormData) {
  const notificationId = String(formData.get("notificationId") ?? "");
  if (!notificationId) return;

  const user = await getCurrentUser();

  if (!user) return;

  const db = initializeDatabase();

  try {
    await db
      .update(notifications)
      .set({ read: true })
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.user_id, user.id),
          eq(notifications.read, false)
        )
      );
  } catch (err) {
    console.error("Error marking notification as read:", err);
  }

  revalidatePath("/notifications");
}

export async function markAllNotificationsRead() {
  const user = await getCurrentUser();

  if (!user) return;

  const db = initializeDatabase();

  try {
    await db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.user_id, user.id), eq(notifications.read, false)));
  } catch (err) {
    console.error("Error marking all notifications as read:", err);
  }

  revalidatePath("/notifications");
}