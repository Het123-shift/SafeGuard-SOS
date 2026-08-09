import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendSOSPayload {
  userId?: string;
  userName: string;
  latitude: number;
  longitude: number;
  contactPhones: string[];
}

interface PerContactStatus {
  phone: string;
  status: 'sent' | 'failed';
  messageSid?: string;
  error?: string;
}

/**
 * Validates and formats a phone number into strict E.164 format (+[1-9]\d{1,14}).
 * Handles raw numbers, numbers with spaces/dashes, or prefixed with whatsapp:.
 */
function formatE164(rawPhone: string): string | null {
  let cleaned = rawPhone.trim();

  // Strip 'whatsapp:' prefix if present
  if (cleaned.toLowerCase().startsWith('whatsapp:')) {
    cleaned = cleaned.substring(9).trim();
  }

  // Remove non-digit characters except leading plus
  cleaned = cleaned.replace(/(?!^\+)\D/g, '');

  // Prepend '+' if missing
  if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }

  // E.164 standard regex: '+' followed by country code (1-9) and 1 to 14 subscriber digits
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  if (e164Regex.test(cleaned)) {
    return cleaned;
  }

  return null;
}

/**
 * Formats a phone number for MSG91 API:
 * Validates via formatE164, then strips '+' to leave pure digits with country code (e.g. "919876543210").
 */
function formatMSG91Phone(rawPhone: string): string | null {
  const e164 = formatE164(rawPhone);
  if (!e164) return null;
  return e164.replace(/^\+/, '');
}

serve(async (req: Request) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const msg91AuthKey = Deno.env.get('MSG91_AUTH_KEY');
    const senderId = Deno.env.get('MSG91_SENDER_ID') || 'SOSALT';

    // Requirement 1: Require MSG91_AUTH_KEY environment secret
    if (!msg91AuthKey) {
      const errorMsg = 'MSG91 configuration error: Missing required environment secret MSG91_AUTH_KEY';
      console.error(`[send-sos-sms] ${errorMsg}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: errorMsg,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const payload: SendSOSPayload = await req.json();
    const { userName, latitude, longitude, contactPhones } = payload;

    if (!userName || latitude === undefined || longitude === undefined || !Array.isArray(contactPhones)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid request payload. Required: userName, latitude, longitude, contactPhones[]',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Requirement 3: SOS Emergency Message Format
    const messageText = `🚨 EMERGENCY SOS ALERT!\n\n${userName} needs help!\nLive Location: https://maps.google.com/?q=${latitude},${longitude}`;

    const results: PerContactStatus[] = [];

    // Requirement 4: Loop through contactPhones and send SMS via MSG91
    for (const rawPhone of contactPhones) {
      if (!rawPhone || !rawPhone.trim()) continue;

      // Requirement 2: Clean digits without '+' format (e.g. "919876543210")
      const msg91Phone = formatMSG91Phone(rawPhone);
      if (!msg91Phone) {
        const errorMsg = `Invalid phone number format for contact: "${rawPhone}"`;
        console.error(`[send-sos-sms] ${errorMsg}`);
        results.push({
          phone: rawPhone,
          status: 'failed',
          error: errorMsg,
        });
        continue;
      }

      console.log(`[send-sos-sms] Dispatching MSG91 SMS to ${msg91Phone} via sender ${senderId}`);

      try {
        // MSG91 sendhttp.php legacy HTTP API query parameters
        const params = new URLSearchParams({
          authkey: msg91AuthKey,
          mobiles: msg91Phone,
          message: messageText,
          sender: senderId,
          route: '4',
          country: '0',
        });

        const msg91Url = `https://api.msg91.com/api/sendhttp.php?${params.toString()}`;

        const msg91Res = await fetch(msg91Url, {
          method: 'GET',
        });

        const responseText = await msg91Res.text();

        // Requirement 5: Check response and log raw response for visibility
        if (msg91Res.ok && !responseText.toLowerCase().includes('error')) {
          console.log(`[send-sos-sms] MSG91 SMS sent successfully to ${msg91Phone}. Response: ${responseText}`);
          results.push({
            phone: rawPhone,
            status: 'sent',
            messageSid: responseText.trim(),
          });
        } else {
          const errorMsg = `MSG91 SMS Error (HTTP ${msg91Res.status}): ${responseText}`;
          console.error(`[send-sos-sms] MSG91 dispatch failed for ${msg91Phone}:`, {
            httpStatus: msg91Res.status,
            rawResponse: responseText,
          });
          results.push({
            phone: rawPhone,
            status: 'failed',
            error: errorMsg,
          });
        }
      } catch (err: any) {
        console.error(`[send-sos-sms] Network/runtime error sending MSG91 SMS to ${msg91Phone}:`, err);
        results.push({
          phone: rawPhone,
          status: 'failed',
          error: err.message || 'Network dispatch failure',
        });
      }
    }

    // Requirement 7: Return response shape { success, results }
    const allSent = results.length > 0 && results.every((r) => r.status === 'sent');

    return new Response(
      JSON.stringify({
        success: allSent,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    console.error('[send-sos-sms] Edge Function fatal error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || 'Internal Edge Function Server Error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

/*
// ============================================================================
// Requirement 6: PREVIOUS TWILIO WHATSAPP / SMS CODE (RETAINED FOR REFERENCE)
// ============================================================================
//
// const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
// const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
// const twilioWhatsAppNumber = Deno.env.get('TWILIO_WHATSAPP_NUMBER');
//
// const cleanFrom = twilioWhatsAppNumber ? twilioWhatsAppNumber.trim() : '';
// const fromWhatsApp = cleanFrom.toLowerCase().startsWith('whatsapp:')
//   ? cleanFrom
//   : `whatsapp:${cleanFrom.startsWith('+') ? cleanFrom : '+' + cleanFrom}`;
//
// const toWhatsApp = `whatsapp:${e164Phone}`;
// const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
// const authHeader = `Basic ${btoa(`${accountSid}:${authToken}`)}`;
//
// const formData = new URLSearchParams();
// formData.append('From', fromWhatsApp);
// formData.append('To', toWhatsApp);
// formData.append('Body', messageText);
//
// const twilioRes = await fetch(twilioUrl, {
//   method: 'POST',
//   headers: {
//     'Authorization': authHeader,
//     'Content-Type': 'application/x-www-form-urlencoded',
//   },
//   body: formData.toString(),
// });
// ============================================================================
*/
