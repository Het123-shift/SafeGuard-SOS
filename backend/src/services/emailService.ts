import nodemailer from 'nodemailer';
import { env } from '../config/env';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  /**
   * Dispatch an email via configured provider (Resend, SendGrid, SMTP/Gmail) or console logger
   */
  static async sendEmail(options: SendEmailOptions): Promise<{ success: boolean; provider: string; id?: string }> {
    const { to, subject, html, text } = options;

    // 1. Resend API Provider (if RESEND_API_KEY is configured)
    if (env.RESEND_API_KEY) {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: env.EMAIL_FROM || 'SafeGuard SOS <onboarding@resend.dev>',
            to: [to],
            subject,
            html,
            text,
          }),
        });

        if (response.ok) {
          const data: any = await response.json();
          console.log(`[EmailService] Dispatched via Resend API to ${to} (ID: ${data.id})`);
          return { success: true, provider: 'resend', id: data.id };
        } else {
          const errData = await response.text();
          console.warn('[EmailService] Resend API error:', errData);
        }
      } catch (err: any) {
        console.warn('[EmailService] Failed to send via Resend:', err.message);
      }
    }

    // 2. SendGrid Provider (if SENDGRID_API_KEY is configured)
    if (env.SENDGRID_API_KEY) {
      try {
        const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.SENDGRID_API_KEY}`,
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: to }] }],
            from: { email: env.EMAIL_FROM.replace(/.*<(.+)>/, '$1') || 'alerts@safeguard-sos.app' },
            subject,
            content: [{ type: 'text/html', value: html }],
          }),
        });

        if (response.status >= 200 && response.status < 300) {
          console.log(`[EmailService] Dispatched via SendGrid to ${to}`);
          return { success: true, provider: 'sendgrid' };
        }
      } catch (err: any) {
        console.warn('[EmailService] Failed to send via SendGrid:', err.message);
      }
    }

    // 3. SMTP / Gmail Provider (if SMTP_USER and SMTP_PASS are configured)
    if (env.SMTP_USER && env.SMTP_PASS) {
      try {
        const isGmail = env.SMTP_HOST.includes('gmail') || env.SMTP_USER.includes('@gmail.com');
        const transporter = nodemailer.createTransport({
          host: env.SMTP_HOST || 'smtp.gmail.com',
          port: parseInt(env.SMTP_PORT || '465', 10),
          secure: (env.SMTP_PORT === '465' || isGmail),
          auth: {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS,
          },
        });

        const info = await transporter.sendMail({
          from: env.EMAIL_FROM || `SafeGuard SOS <${env.SMTP_USER}>`,
          to,
          subject,
          text,
          html,
        });

        console.log(`[EmailService] Dispatched via SMTP to ${to} (MessageId: ${info.messageId})`);
        return { success: true, provider: 'smtp', id: info.messageId };
      } catch (err: any) {
        console.warn('[EmailService] Failed to send via SMTP:', err.message);
      }
    }

    // 4. Development / Fallback Console Logger (Always Active for Safe Delivery)
    console.log('\n======================================================');
    console.log(' 🛡️  SAFEGUARD SOS — EMERGENCY EMAIL OTP DISPATCH');
    console.log('======================================================');
    console.log(` TO      : ${to}`);
    console.log(` SUBJECT : ${subject}`);
    console.log(` MESSAGE :\n${text || 'HTML Email Body Delivered'}`);
    console.log('======================================================\n');

    return { success: true, provider: 'console' };
  }

  /**
   * Helper to format and send a security OTP verification email
   */
  static async sendOTP(email: string, otp: string): Promise<{ success: boolean; provider: string }> {
    const subject = `Your SafeGuard SOS Verification Code: ${otp}`;
    const text = `Your SafeGuard SOS verification code is: ${otp}\n\nThis code expires in 5 minutes.\nDo not share this code with anyone.`;
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0d1117; color: #ffffff; padding: 24px; }
            .container { max-width: 500px; margin: 0 auto; background: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 32px; text-align: center; }
            .badge { display: inline-block; background: #dc2626; color: #ffffff; font-weight: 700; padding: 6px 14px; border-radius: 9999px; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 20px; }
            h1 { font-size: 22px; font-weight: 700; margin: 0 0 12px; color: #ffffff; }
            p { color: #8b949e; font-size: 15px; line-height: 1.5; margin: 0 0 24px; }
            .otp-box { background: #21262d; border: 2px dashed #dc2626; border-radius: 8px; padding: 18px; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #ef4444; margin: 24px 0; font-family: monospace; }
            .footer { font-size: 13px; color: #6e7681; border-top: 1px solid #30363d; padding-top: 20px; margin-top: 24px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="badge">SafeGuard SOS Security</div>
            <h1>Verification Code</h1>
            <p>Use the 4-digit one-time password below to authenticate with your SafeGuard SOS account:</p>
            <div class="otp-box">${otp}</div>
            <p>This code will expire in <strong>5 minutes</strong>. If you did not request this code, please ignore this email or review your account security.</p>
            <div class="footer">
              &copy; ${new Date().getFullYear()} SafeGuard SOS Personal Safety Network. All rights reserved.
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({ to: email, subject, text, html });
  }
}
