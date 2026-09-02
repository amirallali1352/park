# HTTP Security Baseline

Every API response includes a unique `X-Request-ID` for tracing and the
following browser security headers:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`
- a restrictive Content Security Policy for the Pilot dashboard
- `Permissions-Policy` disabling camera, microphone, and geolocation access

The request ID should be included in support tickets and correlated with
application logs when centralized logging is enabled.
