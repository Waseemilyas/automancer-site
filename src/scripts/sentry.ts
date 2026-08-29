import * as Sentry from '@sentry/browser';

/**
 * Static-site Sentry bootstrap.
 *
 * Vite exposes only PUBLIC_* variables to browser bundles. This module stays
 * inert in development, preview and test builds so those environments cannot
 * consume the production error budget or send visitor data to Sentry.
 */
const dsn = import.meta.env.PUBLIC_AUT_SENTRY_WEB_DSN;

if (import.meta.env.PROD && dsn) {
  Sentry.init({
    dsn,
    environment: 'production',
    // Do not attach cookies, IP-derived user context, or form data by default.
    sendDefaultPii: false,
    // This project is for error detection. Performance telemetry remains off.
    tracesSampleRate: 0,
    // @sentry/browser 10.71.0 flipped this default to true. Nothing here calls
    // Sentry.logger.* or adds a log-forwarding integration, so no logs ship
    // either way — but the privacy page tells visitors exactly what Sentry
    // receives, so the default is pinned rather than inherited.
    enableLogs: false,
  });
}
