/**
 * Allow /embed/* to be framed on third-party sites.
 * Must run after routeRules so site-wide X-Frame-Options: DENY is cleared.
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('beforeResponse', (event) => {
    const path = event.path || getRequestURL(event).pathname;
    if (!path.startsWith('/embed/')) return;

    removeResponseHeader(event, 'X-Frame-Options');
    setResponseHeader(
      event,
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data: blob: https:",
        "connect-src 'self'",
        "frame-ancestors *",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; '),
    );
  });
});
