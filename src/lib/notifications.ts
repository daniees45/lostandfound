import { randomUUID } from "crypto";
import { sendEmail } from "@/lib/email";
import { initializeDatabase } from "@/lib/db";
import { notifications, profiles } from "@/lib/schema";
import { prioritizeNotifications } from "@/lib/ai-service-client";
import { eq } from "drizzle-orm";

type NotifyStatusChangeInput = {
  userId: string;
  email?: string | null;
  itemTitle: string;
  newStatus: "claimed" | "held_at_pickup" | "returned";
};

async function logNotification(
  userId: string,
  type: "claim_submitted" | "claim_approved" | "claim_rejected" | "item_found",
  title: string,
  message: string,
  read = false
) {
  const db = initializeDatabase();
  const userSettings = await db
    .select({ inAppEnabled: profiles.in_app_notifications_enabled })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .get();

  if (userSettings?.inAppEnabled === false) {
    return;
  }

  await db.insert(notifications).values({
    id: `notif_${randomUUID()}`,
    user_id: userId,
    type,
    title,
    message,
    read,
  });
}

export async function notifyStatusChange({
  userId,
  email,
  itemTitle,
  newStatus,
}: NotifyStatusChangeInput) {
  const message = `Update: \"${itemTitle}\" is now marked as ${newStatus}.`;
  const db = initializeDatabase();
  const userSettings = await db
    .select({
      emailEnabled: profiles.email_notifications_enabled,
      digestFrequency: profiles.digest_frequency,
    })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .get();

  const emailEnabled = userSettings?.emailEnabled !== false;
  const digestFrequency = userSettings?.digestFrequency ?? "instant";

  // Determine notification priority before logging
  const prioritized = await prioritizeNotifications([
    { user_id: userId, message, type: "status_change", status: newStatus, item_title: itemTitle },
  ]);
  const priorityItem = prioritized[0] as Record<string, unknown> | undefined;
  const priorityScore: number =
    typeof priorityItem?.priority_score === "number" ? priorityItem.priority_score : 0.5;
  const priorityLabel =
    priorityScore >= 0.7 ? "[HIGH]" : priorityScore >= 0.4 ? "[NORMAL]" : "[LOW]";

  if (!emailEnabled) {
    await logNotification(userId, "item_found", "Email update skipped", "Email notifications are disabled in your settings.");
  } else if (digestFrequency !== "instant") {
    await logNotification(
      userId,
      "item_found",
      "Email update queued",
      `Email notifications are set to ${digestFrequency}. This update will be included in a digest.`
    );
  } else {
    const emailResult = await sendEmail({
      to: email ?? "",
      subject: "Lost & Found status update",
      text: message,
    });

    if (emailResult === "sent") {
      await logNotification(userId, "item_found", "Status update sent", message);
    } else if (emailResult === "failed") {
      await logNotification(userId, "item_found", "Status update failed", message);
    } else {
      await logNotification(userId, "item_found", "Status update queued", message);
    }
  }

  // Only send SMS for normal/high priority notifications (score >= 0.4)
  if (priorityScore >= 0.4) {
    await logNotification(userId, "item_found", "SMS preview", `${priorityLabel} [SMS PREVIEW] ${message}`);
  }
}