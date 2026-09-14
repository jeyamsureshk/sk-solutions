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
    const payload = await req.json();
    console.log("Received attendance payload:", payload);

    const targetEmail = payload.email;
    if (!targetEmail) {
      throw new Error("Missing recipient 'email' field in request body.");
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'SK Solutions Global <onboarding@resend.dev>',
        to: [targetEmail], // Resend prefers an array of emails
        subject: `Attendance Logged: ${payload.date}`,
        html: `
          <div style="font-family: sans-serif; color: #334155; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #E2E8F0; border-radius: 12px;">
            <h2 style="color: #1E293B; border-bottom: 2px solid #E2E8F0; padding-bottom: 10px;">Attendance Confirmation</h2>
            <p>Your attendance record has been successfully saved in the system.</p>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <tr><td style="padding: 8px 0; border-bottom: 1px solid #E2E8F0;"><strong>Date:</strong></td><td style="text-align: right; border-bottom: 1px solid #E2E8F0;">${payload.date}</td></tr>
              <tr><td style="padding: 8px 0; border-bottom: 1px solid #E2E8F0;"><strong>Status:</strong></td><td style="text-align: right; border-bottom: 1px solid #E2E8F0;">${payload.status}</td></tr>
              <tr><td style="padding: 8px 0; border-bottom: 1px solid #E2E8F0;"><strong>Login Time:</strong></td><td style="text-align: right; border-bottom: 1px solid #E2E8F0;">${payload.loginTime || 'N/A'}</td></tr>
              <tr><td style="padding: 8px 0; border-bottom: 1px solid #E2E8F0;"><strong>Logout Time:</strong></td><td style="text-align: right; border-bottom: 1px solid #E2E8F0;">${payload.logoutTime || 'N/A'}</td></tr>
            </table>

            <h3 style="color: #1E293B; margin-top: 20px;">Month-to-Date Summary</h3>
            <div style="background-color: #F8FAFC; padding: 15px; border-radius: 8px; border: 1px solid #E2E8F0;">
              <ul style="list-style: none; padding: 0; margin: 0;">
                <li style="margin-bottom: 8px; font-size: 15px;"><strong>Attendance Rate:</strong> ${payload.summary?.attendancePercentage || 0}% (${payload.summary?.presentDays || 0}/${payload.summary?.totalDays || 0} days)</li>
                <li style="margin-bottom: 8px;"><strong>Leave Days Taken:</strong> ${payload.summary?.leaveDays || 0} days</li>
                <li style="margin-bottom: 12px;"><strong>Permission / Late Days:</strong> ${payload.summary?.permissionDays || 0} days</li>
                <li style="padding-top: 10px; border-top: 1px solid #CBD5E1; color: #059669; font-weight: bold;">Total Overtime Hours: ${payload.summary?.totalOvertimeHours || 0} hours</li>
              </ul>
            </div>
            
            <p style="margin-top: 20px; font-size: 12px; color: #64748B; text-align: center;">SK Solutions Production Tracking System</p>
          </div>
        `,
      })
    })

    const data = await res.json()
    console.log("Resend API Response:", data);

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: res.ok ? 200 : 400,
    })
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
