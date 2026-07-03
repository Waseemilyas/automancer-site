/**
 * Site-wide runtime configuration.
 *
 * This is the ONE obvious place later passes (form-backend integration,
 * security) should edit to point the site at real, live endpoints/keys.
 * Everything here is a placeholder as of the structure-only scaffold.
 */

/**
 * Contact form submission target.
 *
 * IMPORTANT — no third-party form processors (Formspree, Netlify Forms,
 * Basin, etc.). The previous site posted to Formspree; that is being
 * deliberately replaced. The AUTD intake endpoint is being built
 * separately and will own contact-form ingestion end to end. Do NOT wire
 * this to a third-party SaaS form processor — replace the placeholder
 * below with the AUTD intake endpoint URL only.
 */
export const ENDPOINT_URL = 'https://REPLACE_WITH_AUTD_INTAKE_ENDPOINT.example/contact';

/**
 * Cloudflare Turnstile site key for the contact form widget.
 * Replace with the real site key when Turnstile is provisioned for
 * automancer.uk. This placeholder is Cloudflare's published "always
 * passes" test key, so local/dev builds render a working widget without
 * a live Turnstile account.
 * https://developers.cloudflare.com/turnstile/troubleshooting/testing/
 */
export const TURNSTILE_SITE_KEY = '1x00000000000000000000AA';
