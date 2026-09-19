/** Concise transactional email copy — no marketing fluff. */

export function tipReceivedEmail(params: {
  amount: string;
  currency: string;
  isAnonymous: boolean;
  supporterName: string | null;
}): { subject: string; text: string; html: string } {
  const who = params.isAnonymous
    ? 'Someone'
    : params.supporterName?.trim() || 'A supporter';
  const subject = 'Someone supported your work';
  const text = `${who} supported your work with ${params.amount} ${params.currency} on TippyMe.`;
  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; color: #1a1228; line-height: 1.5;">
  <p>${escapeHtml(who)} supported your work.</p>
  <p style="font-size: 22px; font-weight: 700;">${escapeHtml(params.amount)} ${escapeHtml(params.currency)}</p>
  <p style="color: #6b5f8a;">Your Tippy support was received. This is a confirmation only — not a marketing message.</p>
</body>
</html>`.trim();
  return { subject, text, html };
}

export function tipReversedEmail(params: {
  amount: string;
  currency: string;
  status: 'REFUNDED' | 'DISPUTED';
}): { subject: string; text: string; html: string } {
  const reversed = params.status === 'REFUNDED' ? 'refunded' : 'disputed';
  const subject = params.status === 'REFUNDED'
    ? 'A support payment was refunded'
    : 'A support payment was disputed';
  const text = `A ${params.amount} ${params.currency} support payment was ${reversed}. It is no longer counted as received. If that money was already paid out to you, contact support so it can be recovered. TippyMe does not reverse payouts automatically.`;
  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; color: #1a1228; line-height: 1.5;">
  <p>A support payment was ${reversed}.</p>
  <p style="font-size: 22px; font-weight: 700;">${escapeHtml(params.amount)} ${escapeHtml(params.currency)}</p>
  <p style="color: #6b5f8a;">It is no longer counted as received. If that money was already paid out to you, contact support so it can be recovered. TippyMe does not reverse payouts automatically.</p>
</body>
</html>`.trim();
  return { subject, text, html };
}

export function supporterReceiptEmail(params: {
  amount: string;
  currency: string;
  creatorName: string;
}): { subject: string; text: string; html: string } {
  const subject = `Receipt for your support of ${params.creatorName}`;
  const text = `Your ${params.amount} ${params.currency} support payment to ${params.creatorName} was verified by Bachs. This is a receipt, not a promise that the creator has already been paid out.`;
  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; color: #1a1228; line-height: 1.5;">
  <p>Your support payment was verified.</p>
  <p style="font-size: 22px; font-weight: 700;">${escapeHtml(params.amount)} ${escapeHtml(params.currency)}</p>
  <p style="color: #6b5f8a;">Paid to support ${escapeHtml(params.creatorName)}. Bachs verified the payment. This receipt is not a payout confirmation for the creator.</p>
</body>
</html>`.trim();
  return { subject, text, html };
}

export function supporterReversalEmail(params: {
  amount: string;
  currency: string;
  creatorName: string;
  status: 'REFUNDED' | 'DISPUTED';
}): { subject: string; text: string; html: string } {
  const reversed = params.status === 'REFUNDED' ? 'refunded' : 'disputed';
  const subject = params.status === 'REFUNDED'
    ? 'Your support payment was refunded'
    : 'Your support payment was disputed';
  const text = `Your ${params.amount} ${params.currency} support payment to ${params.creatorName} was ${reversed}. It is no longer counted as received. Bachs handles the money movement. TippyMe does not hold a withdrawable wallet.`;
  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; color: #1a1228; line-height: 1.5;">
  <p>Your support payment was ${reversed}.</p>
  <p style="font-size: 22px; font-weight: 700;">${escapeHtml(params.amount)} ${escapeHtml(params.currency)}</p>
  <p style="color: #6b5f8a;">This was for ${escapeHtml(params.creatorName)}. It is no longer counted as received. If money already reached the creator’s Bachs balance, recovery is handled through Bachs, not a TippyMe wallet.</p>
</body>
</html>`.trim();
  return { subject, text, html };
}

export function accountExistsEmail(): { subject: string; text: string; html: string } {
  const subject = 'Sign in to TippyMe';
  const text = 'An account with this email already exists. Sign in instead of creating a new one. If you did not request this, you can ignore the email.';
  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; color: #1a1228; line-height: 1.5;">
  <p>An account with this email already exists.</p>
  <p style="color: #6b5f8a;">Sign in instead of requesting a new code. If you did not try to sign up, you can ignore this email.</p>
</body>
</html>`.trim();
  return { subject, text, html };
}

export function accountVerifiedEmail(): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = 'Your account was verified';
  const text =
    'Your TippyMe account was verified. You can sign in and set up your creator page.';
  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; color: #1a1228; line-height: 1.5;">
  <p>Your TippyMe account was verified.</p>
  <p style="color: #6b5f8a;">You can sign in and set up your creator page whenever you are ready.</p>
</body>
</html>`.trim();
  return { subject, text, html };
}

/** Sent after the creator's onboarding profile has been saved. */
export function creatorWelcomeEmail(params: {
  displayName: string;
  username: string;
  appUrl: string;
}): { subject: string; text: string; html: string } {
  const name = params.displayName.trim() || params.username;
  const baseUrl = new URL(params.appUrl);
  if (!['https:', 'http:'].includes(baseUrl.protocol) || baseUrl.username || baseUrl.password) {
    throw new Error('Welcome email requires an HTTP(S) application URL without credentials.');
  }
  const pageUrl = new URL(`/${encodeURIComponent(params.username)}`, baseUrl).href;
  const dashboardUrl = new URL('/dashboard', baseUrl).href;
  const subject = 'Welcome to TippyMe! Your page is ready';
  const text = [
    `Hi ${name},`,
    '',
    'Welcome to TippyMe! Your creator page is ready, and we are glad you are here.',
    'You put care into your work. Now the people who appreciate it have a simple way to support you.',
    '',
    `Your TippyMe link: ${pageUrl}`,
    '',
    'Make yourself at home:',
    '1. Share your page. Add your TippyMe link to your bio, posts, or a message to your community.',
    '2. Make it yours. Update your story, social links, and support goal from your dashboard.',
    '3. Check your payout setup. Open your dashboard to connect your payout account and check its status.',
    '',
    `Open your dashboard: ${dashboardUrl}`,
    '',
    'We are rooting for you,',
    'The TippyMe Team',
    '',
    'You received this welcome email because you completed your creator setup on TippyMe.',
  ].join('\n');
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f7f4ff;color:#1a1228;">
  <div style="display:none;font-size:1px;line-height:1px;color:#f7f4ff;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">Your creator page is ready. Share your link and welcome your first supporters.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f7f4ff;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e0f0;border-radius:20px;font-family:Arial,Helvetica,sans-serif;line-height:1.6;">
          <tr>
            <td style="padding:28px 28px 20px;border-bottom:1px solid #eee6ff;">
              <p style="margin:0;font-size:24px;font-weight:700;color:#6e3cc4;">TippyMe</p>
              <p style="margin:4px 0 0;font-size:14px;color:#6b5f8a;">A little support for the work you love.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 12px;font-size:16px;">Hi ${escapeHtml(name)},</p>
              <h1 style="margin:0 0 16px;font-size:28px;line-height:1.25;color:#1a1228;">Your page is ready!</h1>
              <p style="margin:0 0 12px;font-size:16px;">Welcome to TippyMe! We are glad you are here.</p>
              <p style="margin:0 0 24px;font-size:16px;color:#6b5f8a;">You put care into your work. Now the people who appreciate it have a simple way to support you.</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f7f4ff;border:1px solid #e5e0f0;border-radius:12px;">
                <tr>
                  <td style="padding:18px;">
                    <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#6b5f8a;">YOUR TIPPYME LINK</p>
                    <a href="${escapeHtml(pageUrl)}" style="font-size:16px;font-weight:700;color:#6e3cc4;word-break:break-all;">${escapeHtml(pageUrl)}</a>
                  </td>
                </tr>
              </table>
              <h2 style="margin:24px 0 12px;font-size:18px;">Make yourself at home</h2>
              <p style="margin:0 0 12px;font-size:15px;"><strong>1. Share your page.</strong> Add your TippyMe link to your bio, posts, or a message to your community.</p>
              <p style="margin:0 0 12px;font-size:15px;"><strong>2. Make it yours.</strong> Update your story, social links, and support goal from your dashboard.</p>
              <p style="margin:0 0 24px;font-size:15px;"><strong>3. Check your payout setup.</strong> Open your dashboard to connect your payout account and check its status.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="#6e3cc4" style="border-radius:10px;mso-padding-alt:14px 24px;">
                    <a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;padding:14px 24px;border:1px solid #6e3cc4;border-radius:10px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;">Open your dashboard</a>
                  </td>
                </tr>
              </table>
              <p style="margin:16px 0 24px;font-size:12px;color:#6b5f8a;word-break:break-all;">Or visit <a href="${escapeHtml(dashboardUrl)}" style="color:#6e3cc4;">${escapeHtml(dashboardUrl)}</a></p>
              <p style="margin:0;font-size:15px;">We are rooting for you,<br /><strong>The TippyMe Team</strong></p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px;border-top:1px solid #eee6ff;font-size:12px;color:#6b5f8a;">You received this welcome email because you completed your creator setup on TippyMe.</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
  return { subject, text, html };
}

export function securityLoginEmail(params: { method: string; atIso: string }): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = 'New sign-in to your TippyMe account';
  const text = `There was a successful sign-in to your TippyMe account (${params.method}) at ${params.atIso}. If this was not you, reset your password and contact support.`;
  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; color: #1a1228; line-height: 1.5;">
  <p>New sign-in to your TippyMe account.</p>
  <p style="color: #6b5f8a;">Method: ${escapeHtml(params.method)} · ${escapeHtml(params.atIso)}</p>
  <p style="color: #6b5f8a;">If this was not you, change your password and contact support.</p>
</body>
</html>`.trim();
  return { subject, text, html };
}

export function otpEmail(code: string, purpose?: string): {
  subject: string;
  text: string;
  html: string;
} {
  const reset = purpose === 'PASSWORD_RESET';
  const subject = reset
    ? 'Reset your TippyMe password'
    : 'Your TippyMe verification code';
  const title = reset ? 'Password reset code' : 'One Time Password (OTP)';
  const instruction = reset
    ? 'Use this code to reset your TippyMe password. It is valid for 10 minutes. Please do not share it with anyone.'
    : 'Here is your one time passcode to complete authentication. It is valid for 10 minutes. Please do not share it with anyone.';
  const text = [
    'TippyMe',
    title,
    '',
    instruction,
    '',
    code,
    '',
    'Best regards,',
    'The TippyMe Team',
    '',
    'If you did not request this, you can ignore this email.',
  ].join('\n');
  const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#ffffff;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;">
    <tr>
      <td align="center" style="padding:32px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;font-family:system-ui,-apple-system,sans-serif;color:#1a1228;line-height:1.5;text-align:center;">
          <tr>
            <td style="padding-bottom:8px;font-size:22px;font-weight:700;color:#9362ff;">TippyMe</td>
          </tr>
          <tr>
            <td style="padding-bottom:20px;font-size:16px;font-weight:700;color:#1a1228;">${title}</td>
          </tr>
          <tr>
            <td style="border-top:1px solid #e5e0f0;padding-top:24px;font-size:15px;color:#1a1228;">${instruction}</td>
          </tr>
          <tr>
            <td style="padding:28px 0;font-size:36px;font-weight:700;letter-spacing:0.2em;color:#1a1228;">${escapeHtml(code)}</td>
          </tr>
          <tr>
            <td style="padding-bottom:24px;font-size:14px;color:#6b5f8a;">Valid for 10 minutes · Do not share this code</td>
          </tr>
          <tr>
            <td style="border-top:1px solid #e5e0f0;padding-top:24px;font-size:15px;color:#1a1228;">
              Best regards,<br />
              The TippyMe Team
            </td>
          </tr>
          <tr>
            <td style="padding-top:20px;font-size:13px;color:#6b5f8a;">If you did not request this, you can ignore this email.</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
  return { subject, text, html };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
