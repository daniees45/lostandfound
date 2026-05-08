import nodemailer from "nodemailer";

type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

function createTransporter() {
  // Gmail shortcut: set GMAIL_USER + GMAIL_APP_PASSWORD in .env.local
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    return nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }
  // Generic SMTP fallback
  if (
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  ) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return null;
}

function getSender() {
  if (process.env.GMAIL_USER) {
    return `Valley View Lost & Found <${process.env.GMAIL_USER}>`;
  }
  return process.env.SMTP_FROM ?? "noreply@example.com";
}

export async function sendEmail(
  payload: EmailPayload
): Promise<"sent" | "failed" | "skipped"> {
  const transporter = createTransporter();
  if (!transporter || !payload.to) return "skipped";

  try {
    await transporter.sendMail({
      from: getSender(),
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });
    return "sent";
  } catch (err) {
    console.error("[email] send failed:", err);
    return "failed";
  }
}

// ── Pre-built email templates ──────────────────────────────────────────────

function htmlWrap(body: string) {
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f9ff;font-family:system-ui,sans-serif">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <div style="background:#0284c7;padding:24px 32px">
      <h1 style="margin:0;color:#fff;font-size:18px;font-weight:600">Valley View Lost &amp; Found</h1>
    </div>
    <div style="padding:32px">
      ${body}
    </div>
    <div style="background:#f0f9ff;padding:16px 32px;text-align:center">
      <p style="margin:0;font-size:12px;color:#94a3b8">Valley View Lost &amp; Found &mdash; Automated notification</p>
    </div>
  </div>
</body>
</html>`;
}

export function buildWelcomeEmail(fullName: string, loginUrl: string) {
  return {
    subject: "Welcome to Valley View Lost & Found",
    text: `Hi ${fullName},\n\nYour account has been created successfully. Sign in at ${loginUrl}\n\nIf you didn't create this account, please ignore this email.\n\nValley View Lost & Found`,
    html: htmlWrap(`
      <h2 style="margin:0 0 12px;color:#0f172a;font-size:20px">Welcome, ${fullName}!</h2>
      <p style="color:#475569;line-height:1.6">Your Valley View Lost &amp; Found account is ready. You can now report lost items, browse found items, and submit claims.</p>
      <a href="${loginUrl}" style="display:inline-block;margin-top:20px;background:#0284c7;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Sign in to your account</a>
    `),
  };
}

export function buildPasswordResetEmail(resetUrl: string) {
  return {
    subject: "Reset your Valley View Lost & Found password",
    text: `You requested a password reset.\n\nClick the link below (valid for 1 hour):\n${resetUrl}\n\nIf you didn't request this, ignore this email.`,
    html: htmlWrap(`
      <h2 style="margin:0 0 12px;color:#0f172a;font-size:20px">Reset your password</h2>
      <p style="color:#475569;line-height:1.6">Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
      <a href="${resetUrl}" style="display:inline-block;margin-top:20px;background:#0284c7;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Reset password</a>
      <p style="margin-top:24px;color:#94a3b8;font-size:13px">If you didn't request a password reset, you can safely ignore this email.</p>
    `),
  };
}

export function buildClaimStatusEmail(
  claimantName: string,
  itemTitle: string,
  status: "approved" | "rejected"
) {
  const approved = status === "approved";
  const accentColor = approved ? "#059669" : "#dc2626";
  const label = approved ? "Approved" : "Rejected";
  const body = approved
    ? `Your claim for <strong>${itemTitle}</strong> has been <strong style="color:${accentColor}">approved</strong>. Please visit the pickup point to collect your item.`
    : `Your claim for <strong>${itemTitle}</strong> was <strong style="color:${accentColor}">not approved</strong>. If you believe this is an error, please contact the administrator.`;

  return {
    subject: `Claim ${label}: ${itemTitle}`,
    text: `Hi ${claimantName},\n\nYour claim for "${itemTitle}" has been ${label.toLowerCase()}.\n\n${approved ? "Please visit the pickup point to collect your item." : "If you believe this is an error, contact the administrator."}\n\nValley View Lost & Found`,
    html: htmlWrap(`
      <h2 style="margin:0 0 12px;color:#0f172a;font-size:20px">Claim ${label}</h2>
      <p style="color:#475569;line-height:1.6">Hi ${claimantName},</p>
      <p style="color:#475569;line-height:1.6">${body}</p>
    `),
  };
}
