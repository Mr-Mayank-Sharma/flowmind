import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_FROM = process.env.SMTP_FROM || "noreply@flowmind.ai";
const SMTP_SECURE = process.env.SMTP_SECURE === "true" || SMTP_PORT === 465;

export const smtpConfigured = !!(SMTP_HOST && SMTP_USER && SMTP_PASS);

let transporter: nodemailer.Transporter | null = null;

export function getMailer(): nodemailer.Transporter | null {
  if (!smtpConfigured) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return transporter;
}

export async function sendMail(options: { to: string; subject: string; text: string; html?: string }): Promise<boolean> {
  const mailer = getMailer();
  if (!mailer) return false;
  try {
    await mailer.sendMail({ from: SMTP_FROM, ...options });
    return true;
  } catch (err) {
    console.error("Failed to send email:", err);
    return false;
  }
}
