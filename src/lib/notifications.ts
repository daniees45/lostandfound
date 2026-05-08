import { randomUUID } from "crypto";
import { sendEmail } from "@/lib/email";
import { initializeDatabase } from "@/lib/db";
import { notifications } from "@/lib/schema";
import { prioritizeNotifications } from "@/lib/ai-service-client";

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

  // Determine notification priority before logging
  const prioritized = await prioritizeNotifications([
    { user_id: userId, message, type: "status_change", status: newStatus, item_title: itemTitle },
  ]);
  const priorityItem = prioritized[0] as Record<string, unknown> | undefined;
  const priorityScore: number =
    typeof priorityItem?.priority_score === "number" ? priorityItem.priority_score : 0.5;
  const priorityLabel =
    priorityScore >= 0.7 ? "[HIGH]" : priorityScore >= 0.4 ? "[NORMAL]" : "[LOW]";

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

  // Only send SMS for normal/high priority notifications (score >= 0.4)
  if (priorityScore >= 0.4) {
    await logNotification(userId, "item_found", "SMS preview", `${priorityLabel} [SMS PREVIEW] ${message}`);
  }
}