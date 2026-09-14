import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, date, status, shift } = await req.json()

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'SK Solutions Global <onboarding@resend.dev>', // Use your verified domain in production
        to: email,
        subject: `Attendance Logged: ${date}`,
        html: `
          <h2>Attendance Confirmation</h2>
          <p>Your attendance has been successfully recorded in the system.</p>
          <ul>
            <li><strong>Date:</strong> ${date}</li>
            <li><strong>Status:</strong> ${status}</li>
            <li><strong>Shift:</strong> ${shift || 'General'}</li>
          </ul>
          <p>Thank you!</p>
        `,
      })
    })

    const data = await res.json()
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
