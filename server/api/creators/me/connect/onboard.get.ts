import { sendRedirect } from 'h3';

/**
 * Browser navigations hit GET; Connect onboarding is POST-only.
 * Send people back to the dashboard instead of Nuxt's API 404 page.
 */
export default defineEventHandler((event) => {
  return sendRedirect(event, '/dashboard?connect=1', 302);
});
