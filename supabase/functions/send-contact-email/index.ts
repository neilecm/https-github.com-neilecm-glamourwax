// supabase/functions/send-contact-email/index.ts

declare const Deno: {
  env: { get(key: string): string | undefined; };
};

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const RESEND_API_URL = 'https://api.resend.com/emails';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Basic email validation regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { name, email, subject, message } = await req.json();

    // --- Input Validation ---
    if (!name || !email || !subject || !message) {
      throw new Error("All fields (name, email, subject, message) are required.");
    }
    if (typeof name !== 'string' || typeof email !== 'string' || typeof subject !== 'string' || typeof message !== 'string') {
      throw new Error("All fields must be strings.");
    }
    if (!emailRegex.test(email)) {
      throw new Error("Please provide a valid email address.");
    }

    // --- Get Secrets ---
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const CONTACT_EMAIL_RECIPIENT = Deno.env.get('CONTACT_EMAIL_RECIPIENT');

    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not set in Supabase secrets.");
    }
    if (!CONTACT_EMAIL_RECIPIENT) {
      throw new Error("CONTACT_EMAIL_RECIPIENT is not set in Supabase secrets.");
    }

    // --- Construct and Send Email ---
    const emailPayload = {
      from: 'Contact Form <onboarding@resend.dev>', // Resend requires this format for the free tier
      to: [CONTACT_EMAIL_RECIPIENT],
      subject: `New Contact Form Submission: ${subject}`,
      reply_to: email,
      html: `
        <div style="font-family: sans-serif; line-height: 1.6;">
          <h2>New Message from Cera Brasileira Contact Form</h2>
          <p>You have received a new message from your website's contact form.</p>
          <hr>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
          <p><strong>Subject:</strong> ${subject}</p>
          <h3>Message:</h3>
          <p style="background-color: #f4f4f4; padding: 15px; border-radius: 5px;">
            ${message.replace(/\n/g, '<br>')}
          </p>
        </div>
      `,
    };

    const resendResponse = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    });

    const resendJson = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error("Resend API Error:", resendJson);
      const errorMessage = resendJson?.message || 'Failed to send email via provider.';
      throw new Error(`[Resend API] ${errorMessage}`);
    }

    console.log("Successfully sent email via Resend:", resendJson.id);

    return new Response(JSON.stringify({ success: true, message: 'Message sent successfully!' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    console.error("Error in send-contact-email function:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});