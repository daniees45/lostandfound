import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";
import { prioritizeNotifications } from "@/lib/ai-service-client";

type NotifyStatusChangeInput = {
  supabase: SupabaseClient;
  userId: string;
  email?: string | null;
  itemTitle: string;
  newStatus: "claimed" | "held_at_pickup" | "returned";
};

async function logNotification(
  supabase: SupabaseClient,
  userId: string,
  channel: "email" | "sms_dummy",
  message: string,
  status: "queued" | "sent" | "failed"
) {
  await supabase.from("notification_logs").insert({
    user_id: userId,
    channel,
    message,
    status,
    is_read: false,
  });
}

export async function notifyStatusChange({
  supabase,
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
    await logNotification(supabase, userId, "email", message, "sent");
  } else if (emailResult === "failed") {
    await logNotification(supabase, userId, "email", message, "failed");
  } else {
    await logNotification(supabase, userId, "email", message, "queued");
  }

  // Only send SMS for normal/high priority notifications (score >= 0.4)
  if (priorityScore >= 0.4) {
    await logNotification(
      supabase,
      userId,
      "sms_dummy",
      `${priorityLabel} [SMS PREVIEW] ${message}`,
      "sent"
    );
  }
}