import { env } from '../config/env';

export interface SMSContactResult {
  phone: string;
  status: 'sent' | 'failed';
  messageSid?: string;
  error?: string;
}

export function formatE164(rawPhone: string): string | null {
  let cleaned = rawPhone.trim();
  if (cleaned.toLowerCase().startsWith('whatsapp:')) {
    cleaned = cleaned.substring(9).trim();
  }
  cleaned = cleaned.replace(/(?!^\+)\D/g, '');
  if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(cleaned) ? cleaned : null;
}

export function formatMSG91Phone(rawPhone: string): string | null {
  const e164 = formatE164(rawPhone);
  if (!e164) return null;
  return e164.replace(/^\+/, '');
}

export const SMSService = {
  /**
   * Dispatch secondary emergency SMS alerts to trusted contacts via MSG91 / Twilio.
   */
  async dispatchSOSEmergencySMS(
    userName: string,
    latitude: number,
    longitude: number,
    contactPhones: string[],
    trackingUrl?: string
  ): Promise<{ success: boolean; results: SMSContactResult[] }> {
    const trackingLink = trackingUrl || `https://maps.google.com/?q=${latitude},${longitude}`;
    const messageText = `🚨 EMERGENCY SOS ALERT!\n\n${userName} needs help!\nLive Location: https://maps.google.com/?q=${latitude},${longitude}\nTrack Live: ${trackingLink}`;

    const results: SMSContactResult[] = [];

    for (const rawPhone of contactPhones) {
      if (!rawPhone || !rawPhone.trim()) continue;

      const formatted = formatE164(rawPhone);
      if (!formatted) {
        results.push({
          phone: rawPhone,
          status: 'failed',
          error: `Invalid phone format: "${rawPhone}"`,
        });
        continue;
      }

      // Priority 1: MSG91 API
      if (env.MSG91_AUTH_KEY) {
        const msg91Phone = formatMSG91Phone(rawPhone);
        if (msg91Phone) {
          try {
            const params = new URLSearchParams({
              authkey: env.MSG91_AUTH_KEY,
              mobiles: msg91Phone,
              message: messageText,
              sender: env.MSG91_SENDER_ID,
              route: '4',
              country: '0',
            });

            const response = await fetch(`https://api.msg91.com/api/sendhttp.php?${params.toString()}`);
            const text = await response.text();

            if (response.ok && !text.toLowerCase().includes('error')) {
              results.push({ phone: rawPhone, status: 'sent', messageSid: text.trim() });
              continue;
            }
          } catch (err: any) {
            console.error('[SMSService] MSG91 dispatch failed:', err);
          }
        }
      }

      // Priority 2: Twilio API
      if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER) {
        try {
          const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;
          const authHeader = `Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64')}`;
          const formData = new URLSearchParams();
          formData.append('From', env.TWILIO_FROM_NUMBER);
          formData.append('To', formatted);
          formData.append('Body', messageText);

          const response = await fetch(twilioUrl, {
            method: 'POST',
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString(),
          });

          const data: any = await response.json();
          if (response.ok && data.sid) {
            results.push({ phone: rawPhone, status: 'sent', messageSid: data.sid });
            continue;
          }
        } catch (err: any) {
          console.error('[SMSService] Twilio dispatch failed:', err);
        }
      }

      // If no SMS provider configured in dev/test, mark as simulated sent in development
      if (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') {
        console.log(`[SMSService Mock] Simulated SMS to ${rawPhone}: ${messageText}`);
        results.push({ phone: rawPhone, status: 'sent', messageSid: `mock_sms_${Date.now()}` });
      } else {
        results.push({ phone: rawPhone, status: 'failed', error: 'No SMS credentials configured' });
      }
    }

    const allSent = results.length > 0 && results.some((r) => r.status === 'sent');
    return { success: allSent, results };
  },

  /**
   * Dispatch OTP phone verification SMS.
   */
  async sendOTP(phone: string, code: string): Promise<{ success: boolean; messageSid?: string; error?: string }> {
    const formatted = formatE164(phone);
    if (!formatted) return { success: false, error: 'Invalid phone number' };

    const messageText = `Your SafeGuard SOS Phone Verification Code is: ${code}. Valid for 10 minutes.`;

    if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER) {
      try {
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;
        const authHeader = `Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64')}`;
        const formData = new URLSearchParams();
        formData.append('From', env.TWILIO_FROM_NUMBER);
        formData.append('To', formatted);
        formData.append('Body', messageText);

        const response = await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData.toString(),
        });

        const data: any = await response.json();
        if (response.ok && data.sid) {
          return { success: true, messageSid: data.sid };
        }
        return { success: false, error: data.message || 'Twilio dispatch failure' };
      } catch (err: any) {
        return { success: false, error: err.message || 'SMS service failure' };
      }
    }

    if (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') {
      console.log(`[SMSService Mock] OTP to ${phone}: ${code}`);
      return { success: true, messageSid: `mock_otp_${Date.now()}` };
    }

    return { success: false, error: 'Twilio SMS not configured' };
  },
};
