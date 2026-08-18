// Standard Webhooks signature verification.
//
// Replaces @lovable.dev/webhooks-js. Both Supabase Auth hooks and Resend
// (via Svix) sign with the Standard Webhooks scheme, so one verifier covers
// both callers:
//
//   signature = base64(HMAC_SHA256(secret, "{id}.{timestamp}.{body}"))
//
// sent as `webhook-signature: v1,<sig>` (space-separated list when a secret is
// being rotated). Svix sends the same values under `svix-*` header names.

export type WebhookErrorCode =
  | 'missing_headers'
  | 'invalid_signature'
  | 'stale_timestamp'
  | 'invalid_payload'

export class WebhookError extends Error {
  code: WebhookErrorCode
  constructor(code: WebhookErrorCode, message: string) {
    super(message)
    this.name = 'WebhookError'
    this.code = code
  }
}

// Five minutes either side, matching the Standard Webhooks recommendation.
const TOLERANCE_SECONDS = 5 * 60

function header(req: Request, ...names: string[]): string | null {
  for (const name of names) {
    const value = req.headers.get(name)
    if (value) return value
  }
  return null
}

// Secrets are distributed as `whsec_<base64>`; the raw key is the decoded
// portion. A secret without the prefix is used as raw UTF-8 bytes.
function secretBytes(secret: string): Uint8Array {
  const trimmed = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret
  try {
    const binary = atob(trimmed)
    return Uint8Array.from(binary, (c) => c.charCodeAt(0))
  } catch {
    return new TextEncoder().encode(trimmed)
  }
}

// Length-independent comparison so a mismatch does not leak position via timing.
function constantTimeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder()
  const ab = enc.encode(a)
  const bb = enc.encode(b)
  if (ab.length !== bb.length) return false
  let diff = 0
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i]
  return diff === 0
}

/**
 * Verify a Standard Webhooks request and return the parsed JSON body.
 *
 * Pass the raw body text exactly as received — re-serializing changes the
 * bytes and the signature will not match.
 */
export async function verifyWebhookRequest<T = unknown>(
  req: Request,
  rawBody: string,
  secret: string,
): Promise<T> {
  const id = header(req, 'webhook-id', 'svix-id')
  const timestamp = header(req, 'webhook-timestamp', 'svix-timestamp')
  const signatureHeader = header(req, 'webhook-signature', 'svix-signature')

  if (!id || !timestamp || !signatureHeader) {
    throw new WebhookError('missing_headers', 'Missing webhook signature headers')
  }

  const sentAt = Number(timestamp)
  if (!Number.isFinite(sentAt)) {
    throw new WebhookError('stale_timestamp', 'Malformed webhook timestamp')
  }
  const skew = Math.abs(Math.floor(Date.now() / 1000) - sentAt)
  if (skew > TOLERANCE_SECONDS) {
    throw new WebhookError('stale_timestamp', `Webhook timestamp outside tolerance (${skew}s)`)
  }

  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signed = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${id}.${timestamp}.${rawBody}`),
  )
  const expected = btoa(String.fromCharCode(...new Uint8Array(signed)))

  // The header carries one or more `v1,<sig>` entries; any match is valid.
  const provided = signatureHeader
    .split(' ')
    .map((part) => {
      const comma = part.indexOf(',')
      return comma === -1 ? part : part.slice(comma + 1)
    })
    .filter(Boolean)

  if (!provided.some((candidate) => constantTimeEqual(candidate, expected))) {
    throw new WebhookError('invalid_signature', 'Webhook signature did not match')
  }

  try {
    return JSON.parse(rawBody) as T
  } catch {
    throw new WebhookError('invalid_payload', 'Webhook body was not valid JSON')
  }
}
