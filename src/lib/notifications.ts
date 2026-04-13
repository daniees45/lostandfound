import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";

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

  await logNotification(supabase, userId, "sms_dummy", `[SMS PREVIEW] ${message}`, "sent");
}