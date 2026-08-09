import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendOTPPayload {
  phone: string;
  code: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const fromNumber = Deno.env.get('TWILIO_FROM_NUMBER');

    if (!accountSid || !authToken || !fromNumber) {
      console.warn('Twilio secrets missing in server environment');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Twilio credentials not configured on server.',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const payload: SendOTPPayload = await req.json();
    const { phone, code } = payload;

    if (!phone || !code) {
      return new Response(
        JSON.stringify({ success: false, error: 'Phone and OTP code are required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const messageText = `Your SafeGuard SOS Phone Verification Code is: ${code}. Do not share this code with anyone. Valid for 10 minutes.`;
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const authHeader = `Basic ${btoa(`${accountSid}:${authToken}`)}`;

    const formData = new URLSearchParams();
    formData.append('From', fromNumber);
    formData.append('To', phone.trim());
    formData.append('Body', messageText);

    const twilioRes = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const twilioData = await twilioRes.json();

    if (twilioRes.ok && twilioData.sid) {
      return new Response(
        JSON.stringify({ success: true, messageSid: twilioData.sid }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: twilioData.message || `Twilio HTTP error ${twilioRes.status}`,
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Edge Function send-otp-sms error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
