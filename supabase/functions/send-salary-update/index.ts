import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Initialize the Resend API (You'll set this secret in the next step)
const RESEND_API_KEY = Deno.env.get('re_34yMj7kq_6aph1rEsnooC2JySQnZLR9xn')

serve(async (req) => {
  try {
    const { to, name, gross, net, otHours } = await req.json()

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Ravel Payroll <payroll@sktech.in>', // Replace with your verified domain
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
    return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
