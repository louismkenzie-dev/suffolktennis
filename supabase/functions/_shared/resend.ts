// Resend transactional email sender.
//
// Replaces sendLovableEmail from @lovable.dev/email-js. The thrown error keeps
// the `status` / `retryAfterSeconds` shape that process-email-queue's
// isRateLimited / isForbidden / getRetryAfterSeconds helpers already read, so
// the queue, retry and DLQ logic is unchanged.

export interface EmailPayload {
  to: string
  from?: string
  sender_domain?: string
  subject: string
  html?: string
  text?: string
  run_id?: string
  purpose?: string
  label?: string
  idempotency_key?: string
  unsubscribe_token?: string
  message_id?: string
}

export class EmailAPIError extends Error {
  status: number
  retryAfterSeconds: number | null
  constructor(status: number, message: string, retryAfterSeconds: number | null = null) {
    super(message)
    this.name = 'EmailAPIError'
    this.status = status
    this.retryAfterSeconds = retryAfterSeconds
  }
}

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

// Fallback sender, overridable per-message or via the RESEND_FROM secret.
// The domain must be verified in Resend or every send returns 403.
const DEFAULT_FROM = 'Suffolk Tennis <noreply@suffolktennis.online>'

function resolveFrom(payload: EmailPayload): string {
  if (payload.from) {
    // A bare domain in sender_domain is only useful if `from` has no host part.
    if (!payload.from.includes('@') && payload.sender_domain) {
      return `${payload.from} <noreply@${payload.sender_domain}>`
    }
    return payload.from
  }
  if (payload.sender_domain) {
    return `Suffolk Tennis <noreply@${payload.sender_domain}>`
  }
  return Deno.env.get('RESEND_FROM') ?? DEFAULT_FROM
}

export async function sendEmail(
  payload: EmailPayload,
  options: { apiKey: string; unsubscribeBaseUrl?: string },
): Promise<{ id: string }> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${options.apiKey}`,
    'Content-Type': 'application/json',
  }

  // Resend dedupes on this for 24h, which reinforces the queue's own
  // already-sent check when a visibility timeout expires mid-send.
  if (payload.idempotency_key) {
    headers['Idempotency-Key'] = payload.idempotency_key
  }

  const messageHeaders: Record<string, string> = {}
  if (payload.unsubscribe_token) {
    const base = options.unsubscribeBaseUrl ?? Deno.env.get('UNSUBSCRIBE_BASE_URL')
    if (base) {
      const url = `${base.replace(/\/$/, '')}?token=${encodeURIComponent(payload.unsubscribe_token)}`
      messageHeaders['List-Unsubscribe'] = `<${url}>`
      messageHeaders['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click'
    }
  }

  const body: Record<string, unknown> = {
    from: resolveFrom(payload),
    to: [payload.to],
    subject: payload.subject,
  }
  if (payload.html) body.html = payload.html
  if (payload.text) body.text = payload.text
  if (!payload.html && !payload.text) {
    throw new EmailAPIError(400, 'Email payload had neither html nor text')
  }
  if (Object.keys(messageHeaders).length > 0) body.headers = messageHeaders

  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const detail = await res.text()
    const retryAfter = res.headers.get('retry-after')
    throw new EmailAPIError(
      res.status,
      `Resend ${res.status}: ${detail.slice(0, 500)}`,
      retryAfter ? Number(retryAfter) || 60 : null,
    )
  }

  const data = await res.json().catch(() => ({}))
  return { id: data?.id ?? '' }
}
