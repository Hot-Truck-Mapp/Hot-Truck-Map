import { Resend } from "resend";

let cached: Resend | null = null;

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!cached) cached = new Resend(key);
  return cached;
}

export const NOTIFICATION_FROM =
  process.env.RESEND_FROM_EMAIL || "HotTruckMap <notifications@hottruckmap.com>";

export const ADMIN_INBOX = "info@hottruckmap.com";

type SendArgs = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

export async function sendEmail({ to, subject, html, text, replyTo }: SendArgs) {
  const client = getClient();
  if (!client) {
    console.warn("[email] RESEND_API_KEY not set — skipping send:", subject);
    return { skipped: true as const };
  }
  const { data, error } = await client.emails.send({
    from: NOTIFICATION_FROM,
    to,
    subject,
    html,
    text,
    replyTo,
  });
  if (error) {
    console.error("[email] send failed:", error);
    throw new Error(error.message || "Email send failed");
  }
  return { id: data?.id };
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function operatorSignupEmail(opts: {
  truckName: string;
  cuisine: string | null;
  email: string;
  userId: string;
}): { subject: string; html: string; text: string } {
  const { truckName, cuisine, email, userId } = opts;
  const subject = `New food truck signup: ${truckName}`;
  const rows = [
    ["Truck name", truckName],
    ["Cuisine", cuisine || "—"],
    ["Owner email", email],
    ["User ID", userId],
    ["Signed up", new Date().toLocaleString("en-US", { timeZone: "America/New_York" }) + " ET"],
  ];
  const text =
    `New food truck signup\n\n` +
    rows.map(([k, v]) => `${k}: ${v}`).join("\n") +
    `\n\nReview in Supabase: https://supabase.com/dashboard/project/_/auth/users`;

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f5f5f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#171717;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;">
    <tr><td style="padding:24px 28px;background:#171717;color:#ffffff;">
      <div style="font-weight:900;font-size:18px;letter-spacing:-0.02em;">
        <span style="color:#E8481C;">HOT</span><span>TRUCK</span><span style="color:#F59E0B;">MAP</span>
      </div>
      <div style="margin-top:6px;font-size:12px;color:#a3a3a3;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;">New operator signup</div>
    </td></tr>
    <tr><td style="padding:24px 28px;">
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;">${esc(truckName)}</h1>
      <p style="margin:0 0 20px;color:#525252;font-size:14px;">A new food truck just signed up on hottruckmap.com.</p>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse:collapse;font-size:14px;">
        ${rows
          .map(
            ([k, v]) => `
        <tr>
          <td style="padding:10px 0;color:#737373;width:120px;border-bottom:1px solid #f5f5f5;">${esc(k)}</td>
          <td style="padding:10px 0;color:#171717;font-weight:600;border-bottom:1px solid #f5f5f5;">${esc(v)}</td>
        </tr>`
          )
          .join("")}
      </table>
      <p style="margin:24px 0 0;font-size:12px;color:#a3a3a3;">Note: the operator still needs to confirm their email before they can sign in.</p>
    </td></tr>
  </table>
</body></html>`;

  return { subject, html, text };
}

export function newsletterWelcomeEmail(opts: {
  email: string;
  unsubscribeUrl: string;
}): { subject: string; html: string; text: string } {
  const { email, unsubscribeUrl } = opts;
  const subject = "You're subscribed — The Hot Truck Map Dispatch";

  const text =
    `You're in!\n\n` +
    `Thanks for subscribing to The Hot Truck Map Dispatch, our biweekly roundup of new trucks, features, and food truck news.\n\n` +
    `Read the latest issue any time: https://hottruckmap.com/newsletter\n\n` +
    `Didn't sign up? Unsubscribe here: ${unsubscribeUrl}`;

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f5f5f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#171717;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;">
    <tr><td style="padding:24px 28px;background:#171717;color:#ffffff;">
      <div style="font-weight:900;font-size:18px;letter-spacing:-0.02em;">
        <span style="color:#E8481C;">HOT</span><span>TRUCK</span><span style="color:#F59E0B;">MAP</span>
      </div>
      <div style="margin-top:6px;font-size:12px;color:#a3a3a3;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;">The Hot Truck Map Dispatch</div>
    </td></tr>
    <tr><td style="padding:28px;">
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;">You're in! 📬</h1>
      <p style="margin:0 0 20px;color:#525252;font-size:14px;line-height:1.6;">
        Thanks for subscribing to <strong>The Hot Truck Map Dispatch</strong> — our biweekly roundup
        of new trucks, features, and food truck news. We'll land in your inbox about every two weeks.
      </p>
      <a href="https://hottruckmap.com/newsletter" style="display:inline-block;background:#E8481C;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 24px;border-radius:12px;">
        Read the latest issue
      </a>
      <p style="margin:28px 0 0;font-size:12px;color:#a3a3a3;">
        Sent to ${esc(email)} because you subscribed at hottruckmap.com/newsletter.
        <a href="${esc(unsubscribeUrl)}" style="color:#a3a3a3;">Unsubscribe</a>
      </p>
    </td></tr>
  </table>
</body></html>`;

  return { subject, html, text };
}
