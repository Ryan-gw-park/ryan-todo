import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || ''

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid body' }), { status: 400 })
  }

  const { teamId, email, invitedBy, token } = body
  if (!teamId || !email || !token) {
    return new Response(JSON.stringify({ error: 'teamId, email, token required' }), { status: 400 })
  }

  // Fetch team name for the email
  const { data: team } = await supabase.from('teams').select('name').eq('id', teamId).single()
  const teamName = team?.name || '팀'

  // Fetch inviter name
  let inviterName = ''
  if (invitedBy) {
    const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', invitedBy).single()
    inviterName = profile?.display_name || ''
  }

  // Build invite URL — use the app's origin from the referrer or a configured env var
  const APP_URL = Deno.env.get('APP_URL') || 'https://ryan-todo-master.vercel.app'
  const inviteUrl = `${APP_URL}/invite/${token}`

  // If RESEND_API_KEY is set, send via Resend; otherwise log only (dev mode)
  if (RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: Deno.env.get('EMAIL_FROM') || 'Ryan Todo <noreply@ryantodo.app>',
          to: [email],
          subject: `${inviterName ? inviterName + '님이 ' : ''}${teamName} 팀에 초대했습니다`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
              <div style="text-align: center; margin-bottom: 24px;">
                <div style="display: inline-block; width: 40px; height: 40px; border-radius: 10px; background: #1a1a1a; color: white; font-size: 20px; font-weight: 700; line-height: 40px;">R</div>
              </div>
              <h2 style="text-align: center; font-size: 20px; margin: 0 0 8px;">팀 초대</h2>
              <p style="text-align: center; color: #666; font-size: 14px; margin: 0 0 28px;">
                ${inviterName ? `<strong>${inviterName}</strong>님이 ` : ''}<strong>${teamName}</strong> 팀에 초대했습니다.
              </p>
              <div style="text-align: center;">
                <a href="${inviteUrl}" style="display: inline-block; padding: 12px 32px; background: #1a1a1a; color: white; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 500;">초대 수락하기</a>
              </div>
              <p style="text-align: center; color: #aaa; font-size: 12px; margin-top: 28px;">이 링크는 7일 후 만료됩니다.</p>
            </div>
          `,
        }),
      })
      const result = await res.json()
      if (!res.ok) {
        console.error('[send-invite-email] Resend error:', result)
        return new Response(JSON.stringify({ error: 'email send failed', detail: result }), { status: 500 })
      }
      return new Response(JSON.stringify({ sent: true }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    } catch (err) {
      console.error('[send-invite-email] Resend fetch error:', err)
      return new Response(JSON.stringify({ error: err.message }), { status: 500 })
    }
  }

  // Dev mode — no email API key, just log
  console.log(`[send-invite-email] DEV: invite email for ${email} → ${inviteUrl}`)
  return new Response(
    JSON.stringify({ sent: false, dev: true, inviteUrl }),
    { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } },
  )
})
