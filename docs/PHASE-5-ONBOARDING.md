# Phase 5 — Creator Onboarding

**Status:** Complete  
**Date:** 2026-09-06

## Flow

Account (Phase 4 OTP) → `/onboarding` → Username → Profile → Social → Support → Tippy page `/{username}`

## API

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/creators/username-available?username=` | No | Availability + format/reserved |
| POST | `/api/creators` | Yes | Create own profile |
| GET | `/api/creators/me` | Yes | Own profile |
| PATCH | `/api/creators/me` | Yes | Update profile fields |
| PATCH | `/api/creators/me/settings` | Yes | Currency, support message, tip presets |
| PUT | `/api/creators/me/social-links` | Yes | Replace social links |
| GET | `/api/creators/:username` | No | Public profile |

Ownership always from JWT `sub` — never from client `userId`.

## Username rules

- Normalized lowercase
- `^[a-z0-9_]{3,30}$`
- Reserved set includes routes (`login`, `dashboard`, `api`, …) and brand terms
- Uniqueness via DB unique constraints + unique-violation race handling

## Schema

`CreatorProfile.suggestedTipAmounts` JSON (decimal strings).

## Frontend

- `/onboarding` multi-step with progress
- `/{username}` public Tippy page preview (no payments yet)
- Post-login: no profile → onboarding; else dashboard

## Welcome email

Successful creator profile creation sends a personalized TippyMe welcome email using
the existing Resend transport. This happens after the profile and social links are
committed, for both email and Google signups. Signing up alone, refreshing the page,
or editing an existing profile does not trigger it.

The template is `creatorWelcomeEmail` in
`server/services/notifications/email-templates.ts`. Edit its subject, HTML and plain
text together to customize the copy. It includes the creator's display name, public
page link, dashboard button and getting-started steps, with inline email styles.

Delivery uses `RESEND_API_KEY` and `RESEND_FROM_EMAIL`; links use the configured
`APP_URL` (set it to the public HTTPS site URL in production). No new credentials
or dependencies are required.

Each welcome uses the `creator_welcome_<userId>` idempotency key and is recorded as
`EMAIL_CREATOR_WELCOME` in the notifications collection. Existing `SENT` and
`DELIVERED` records skip delivery. Failed delivery is retried once immediately;
if both attempts fail, a `FAILED` record is stored and onboarding still succeeds.
There is no scheduled retry worker for welcome emails. Database or configuration
errors are logged without failing an already-created profile.

### Testing

Run `npm.cmd test -- tests/creator-welcome.spec.ts` for isolated checks of the
template, onboarding trigger, duplicates, retry and failure handling. These tests
mock the database and email provider; they do not send email.

For an inbox check, run the app with your existing Resend configuration and complete
onboarding with a new test account whose inbox you control. Expect the subject
"Welcome to TippyMe! Your page is ready", the correct name and links, and one
`EMAIL_CREATOR_WELCOME` notification with `SENT` status. `SENT` means the provider
accepted the message, not proof it reached the inbox; check Resend's delivery log
and spam folder too. Refreshing or saving the profile should not send another.

Without `RESEND_API_KEY` in development, the existing `DEV_LOG` transport logs the
recipient and subject only; no email is delivered. Use a fresh test account when
switching from `DEV_LOG` to live delivery because development sends are also
recorded as `SENT`.
