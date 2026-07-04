/**
 * Site-wide runtime configuration.
 *
 * This is the ONE obvious place later passes (form-backend integration,
 * security) should edit to point the site at real, live endpoints/keys.
 * Everything here is a placeholder as of the structure-only scaffold.
 */

/**
 * Contact form submission target — the finalised AUTD lead-intake endpoint.
 *
 * NO third-party form processors (Formspree, Netlify Forms, Basin, etc.).
 * The previous site posted to Formspree; that is deliberately replaced. This
 * endpoint owns contact-form ingestion end to end.
 *
 * Contract (see src/pages/contact.astro for the client implementation):
 *   POST application/json, no credentials.
 *   Body: { name, email, company?, message, turnstileToken, website }
 *         `website` is a honeypot — must submit empty.
 *   Responses: 200 {ok:true} · 400 {error} · 403 turnstile_failed
 *              · 429 {rate_limited, retryAfterMs} · 5xx → mailto fallback.
 *
 * NOTE: the API CORS origin is locked to https://automancer.uk, so live
 * submissions only succeed from the production origin — local `astro dev`
 * / preview will hit a CORS wall (expected), and the form degrades to the
 * mailto fallback there.
 */
export const ENDPOINT_URL = 'https://api.automancer.uk/api/lead';

/** Client-side field limits, mirrored from the intake endpoint's validation. */
export const FIELD_LIMITS = {
  name: 200,
  email: 254,
  company: 200,
  message: 5000,
} as const;

/**
 * Cloudflare Turnstile site key for the contact form widget
 * (widget "automancer.uk lead form", managed mode, domain automancer.uk).
 * Site keys are public by design; the paired secret lives in Paperclip
 * secret management (automancer_turnstile_secret) and is set as
 * TURNSTILE_SECRET in the AUTD Convex deployment.
 */
export const TURNSTILE_SITE_KEY = '0x4AAAAAADvPxrMk2dXVzYwH';
