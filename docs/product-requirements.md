# TippyMe — Product Requirements (MVP)

## Positioning

TippyMe is a **creator-support experience**, not a payment processor.

- **Bachs** moves money.  
- **TippyMe** provides the personal tipping link, messages, anonymity, and creator dashboard.  
- Value prop: *“One link for everyone who wants to support your work.”*

Public creator URL shape: `cheer.cash/{username}` (e.g. `cheer.cash/dina`).

---

## Actors

| Actor | Account? | Goals |
|-------|----------|-------|
| Creator | Yes | Claim username, profile, receive tips, view dashboard, manage payout readiness via Bachs |
| Supporter | No | Open public page, choose amount, optional message, optional anonymous, pay via Bachs |

---

## Creator flow

Sign up → verify email (Resend OTP) → create profile → choose unique username → configure profile → share TippyMe URL → receive tips → dashboard (verified totals by currency, settled vs platform-held, messages, anonymity, payment status). Payout readiness is Bachs Connect: destination charges run only after Bachs enables payouts. TippyMe does not hold a withdrawable wallet.

---

## Supporter flow

Open `/{username}` → view creator → choose amount → optional message → anonymous toggle → Nitro creates tip + Bachs checkout → complete payment on Bachs → TippyMe verifies via webhook → success screen with a confirmation token.

---

## Non-goals (MVP)

- Building a payment processor  
- Supporter accounts  
- Social feed / comments beyond tip messages  
- Native mobile apps  
- Multi-currency conversion as a source of truth. Per-currency totals are real. Converted totals are approximate and only shown when a rate exists.  

---

## Payments (Bachs)

- Server-validated amounts only  
- Internal TippyMe tip ID as Bachs `reference` / metadata  
- Idempotent checkout + webhook handling  
- No client-writable balances or statuses  

Details: [bachs-integration.md](./bachs-integration.md)

---

## Communications (Resend)

- Email verification OTP
- Password reset OTP
- Existing-account sign-in notice (signup does not reveal whether the email exists in the API response)
- Transactional creator and supporter notifications

Email is Resend, not SendByte. See [architecture.md](./architecture.md).

---

## Local development webhooks (OutRay)

Dev-only tunnel for Bachs → local NestJS.  
Production uses deployed HTTPS API.

Details: [outray-development.md](./outray-development.md)
