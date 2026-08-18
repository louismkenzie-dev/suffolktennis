import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { z } from 'npm:zod@3.23.8'

const Body = z.object({
  event_id: z.string().uuid(),
  parent_name: z.string().trim().min(1).max(120),
  parent_email: z.string().trim().email().max(255),
  parent_phone: z.string().trim().max(40).optional().or(z.literal('')),
  parent_club: z.string().trim().max(120).optional().or(z.literal('')),
  player_coach: z.string().trim().max(120).optional().or(z.literal('')),
  child_name: z.string().trim().min(1).max(120),
  child_dob: z.string().trim().max(20).optional().or(z.literal('')),
  child_gender: z.string().trim().max(30).optional().or(z.literal('')),
  session_slot: z.string().trim().max(120).optional().or(z.literal('')),
  medical_notes: z.string().trim().max(1000).optional().or(z.literal('')),
  photo_consent: z.boolean().optional(),
})

const ADMIN_NOTIFY_EMAIL = 'info@suffolktennis.online'

function fmtDate(iso: string | null | undefined) {
  if (!iso) return 'TBC'
  try {
    const d = new Date(iso)
    return d.toLocaleString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return 'TBC' }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceKey)

  let payload
  try {
    const parsed = Body.safeParse(await req.json())
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    payload = parsed.data
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const { data: event, error: eventErr } = await admin
    .from('events')
    .select('id, title, event_date, location, sign_up_enabled')
    .eq('id', payload.event_id)
    .maybeSingle()

  if (eventErr || !event) {
    return new Response(JSON.stringify({ error: 'Event not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
  if (!event.sign_up_enabled) {
    return new Response(JSON.stringify({ error: 'Sign-ups are closed for this event' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const insert = {
    event_id: payload.event_id,
    parent_name: payload.parent_name,
    parent_email: payload.parent_email.toLowerCase(),
    parent_phone: payload.parent_phone || null,
    parent_club: payload.parent_club || null,
    player_coach: payload.player_coach || null,
    child_name: payload.child_name,
    child_dob: payload.child_dob || null,
    child_gender: payload.child_gender || null,
    session_slot: payload.session_slot || null,
    medical_notes: payload.medical_notes || null,
    photo_consent: !!payload.photo_consent,
  }

  const { data: signup, error: insErr } = await admin.from('event_signups').insert(insert).select('id').single()
  if (insErr) {
    console.error('signup insert failed', insErr)
    return new Response(JSON.stringify({ error: 'Failed to save sign-up' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const siteUrl = 'https://suffolktennis.online'
  const eventDateLabel = fmtDate(event.event_date)

  // Fire-and-forget: parent confirmation
  const invokeSend = (body: Record<string, unknown>) =>
    admin.functions.invoke('send-transactional-email', { body }).catch((e) => console.error('send err', e))

  await Promise.all([
    invokeSend({
      templateName: 'rising-stars-confirmation',
      recipientEmail: payload.parent_email,
      idempotencyKey: `rs-confirm-${signup.id}`,
      templateData: {
        parentName: payload.parent_name.split(' ')[0],
        childName: payload.child_name,
        eventTitle: event.title,
        eventDateLabel,
        location: event.location || 'TBC',
        sessionSlot: payload.session_slot || undefined,
        siteUrl,
      },
    }),
    invokeSend({
      templateName: 'rising-stars-admin-notification',
      recipientEmail: ADMIN_NOTIFY_EMAIL,
      idempotencyKey: `rs-admin-${signup.id}`,
      templateData: {
        eventTitle: event.title,
        parentName: payload.parent_name,
        parentEmail: payload.parent_email,
        parentPhone: payload.parent_phone,
        parentClub: payload.parent_club,
        playerCoach: payload.player_coach,
        childName: payload.child_name,
        childDob: payload.child_dob,
        childGender: payload.child_gender,
        sessionSlot: payload.session_slot,
        medicalNotes: payload.medical_notes,
        photoConsent: !!payload.photo_consent,
      },
    }),
  ])

  return new Response(JSON.stringify({ success: true, id: signup.id }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
