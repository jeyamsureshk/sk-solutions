import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// 1. Import the Supabase client
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
// Supabase automatically injects these variables into Edge Functions
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

// 2. Initialize the client securely using the Service Role key to bypass Row Level Security
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

serve(async (req) => {
  try {
    // Calculate the exact time 1 minute ago
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();

    // 3. Query the 'operators' table for anyone updated in the last minute
    const { data: updatedOperators, error } = await supabase
      .from('operators')
      .select('*')
      .gte('updated', oneMinuteAgo)

    if (error) {
      throw error;
    }

    // Stop execution early if no one was updated
    if (!updatedOperators || updatedOperators.length === 0) {
      return new Response(
        JSON.stringify({ message: "No salary updates in the last minute." }), 
        { headers: { "Content-Type": "application/json" } }
      )
    }

    // 4. Loop through all recently updated operators and send an email for each
    const emailPromises = updatedOperators.map(async (operator) => {
      const to = operator.email
      const name = operator.name || 'Team Member'
      
      // Extracting the nested JSON data based on your frontend payload
      const gross = operator.salary_data?.userGrossInput || 0
      const net = operator.net_salary?.netSalary || 0
      const otHours = operator.net_salary?.earnings?.otHours || 0

      // Skip this user if they don't have an email on file
      if (!to) return { status: 'skipped', reason: 'No email address', operatorId: operator.id }

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'Ravel Payroll <payroll@sktech.in>', // MUST be verified in Resend
          to: [to],
          subject: `Salary Structure Updated - ${name}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
              <div style="background-color: #1e293b; padding: 20px; text-align: center;">
                <h1 style="color: white; margin: 0;">Ravel Electronics</h1>
              </div>
              <div style="padding: 24px;">
                <p>Hi <b>${name}</b>,</p>
                <p>Your salary configuration has been successfully updated in the enterprise portal.</p>
                <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0; border: 1px solid #cbd5e1;">
                  <p style="margin: 5px 0;"><b>Gross Base:</b> ₹${Number(gross).toLocaleString()}</p>
                  <p style="margin: 5px 0;"><b>OT Hours Approved:</b> ${otHours} hrs</p>
                  <h2 style="color: #10b981; margin: 10px 0;">Net Take-Home: ₹${Number(net).toLocaleString()}</h2>
                </div>
                <p style="font-size: 12px; color: #64748b;">If you did not authorize this change, please contact HR or IT Support immediately.</p>
              </div>
            </div>
          `,
        }),
      })

      const result = await response.json()
      return { status: 'sent', result, operatorId: operator.id }
    })

    // Wait for all emails to send before responding
    const results = await Promise.all(emailPromises)

    return new Response(JSON.stringify({ message: "Job completed successfully", results }), { 
      headers: { "Content-Type": "application/json" } 
    })

  } catch (error) {
    console.error("Cron function error:", error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
