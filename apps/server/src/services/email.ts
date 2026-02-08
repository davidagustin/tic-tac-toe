import { Resend } from "resend";

let resend: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[Email] RESEND_API_KEY not set — skipping email send");
    return null;
  }
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

export async function sendPasswordResetEmail(to: string, code: string): Promise<void> {
  const client = getResend();
  if (!client) return;

  const from = process.env.FROM_EMAIL || "noreply@game-practice-aws.com";

  await client.emails.send({
    from,
    to,
    subject: "Password Reset Code",
    html: `
      <div style="background-color: #0a0a0a; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="max-width: 400px; margin: 0 auto; text-align: center;">
          <h1 style="color: #f5f5f5; font-size: 24px; margin-bottom: 8px;">Password Reset</h1>
          <p style="color: #a3a3a3; font-size: 16px; margin-bottom: 32px;">
            Enter this code to reset your password:
          </p>
          <div style="background-color: #171717; border: 1px solid #262626; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
            <span style="color: #8b5cf6; font-size: 36px; font-weight: bold; letter-spacing: 8px;">${code}</span>
          </div>
          <p style="color: #737373; font-size: 14px;">
            This code expires in 10 minutes. If you didn't request a password reset, you can safely ignore this email.
          </p>
        </div>
      </div>
    `,
  });
}
