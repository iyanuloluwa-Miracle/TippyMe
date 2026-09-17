# TippyMe Architecture

**Product:** TippyMe (`cheer.cash`) — support/tipping for African creators  
**Status:** Single Nuxt/Nitro process (SSR UI + `/api` backend)  
**Stack note:** Older phase docs that mention NestJS, PostgreSQL, Prisma, or SendByte are historical. The running app is Nuxt, MongoDB, and Resend.

---

## 1. Locked application stack

| Layer | Technology |
|-------|------------|
| App | Vue 3 + Nuxt 3 + Nitro + TypeScript + Tailwind CSS + Pinia |
| Database | MongoDB + Mongoose |
| Payments | Bachs |
| Email | Resend |
| Local webhook tunnel | OutRay (**development only**) |

Do not replace Vue/Nuxt with React/Next.js. Do not replace Bachs with another payment provider.

---

## 2. High-level runtime

```text
Nuxt 3 (TippyMe UI + Nitro /api)
        ├── MongoDB (Mongoose)
        ├── Bachs (payments + Connect)
        ├── Resend (OTP / transactional email)
        └── Webhooks (/api/webhooks/bachs)
```

Browser calls same-origin `/api/*`. SSR uses the same Nitro handlers in-process.

---

## 3. Development vs production money path

### Development

```text
Bachs (sandbox)
   │  HTTPS webhook
   ▼
OutRay public URL (reserved subdomain)
   │
   ▼
Nuxt/Nitro localhost:3000
   │
   ▼
MongoDB
```

### Production

```text
Bachs (live)
   │  HTTPS webhook
   ▼
Public production URL /api/webhooks/bachs
   │
   ▼
MongoDB
```

OutRay is **not** in production.

---

## 4. Money truth

- A tip is `PAID` only after a signed Bachs webhook and a server re-check of amount, currency, and reference.
- Destination charges run only when Bachs reports transfers or payouts as enabled. A stored account id is not enough.
- Dashboard totals split verified support, amount settled to the creator’s Bachs balance, and amount still held by TippyMe. Held amounts are not a withdrawable TippyMe wallet.
- A platform fee applies only to destination-charge tips. It is shown on the support page, dashboard, and terms.
- Per-currency totals are the source of truth. A single converted total is approximate and omitted when a rate is unavailable. Frankfurter does not quote NGN, GHS, or KES.

---

## 5. Bounded contexts (Nitro `server/`)

| Area | Responsibility |
|------|----------------|
| `Auth` | Signup/login, JWT/session cookies, OTP verify |
| `Creators` | Profile, username, public page data, pause and close |
| `Tips` | Tip creation, amounts, messages, anonymity, confirmation token |
| `Payments` | Bachs checkout client, references, status |
| `Webhooks` | Raw-body Bachs verification + fulfilment |
| `Notifications` | Resend email sends |
| `Payouts` | Bachs Connect readiness and Friday schedule. No TippyMe wallet |

---

## 6. Data ownership (logical)

| Concern | System of record |
|---------|------------------|
| Creator identity & profile | TippyMe MongoDB |
| Tip intent, message, anonymity | TippyMe MongoDB |
| Tip paid / failed | TippyMe MongoDB, updated only after Bachs verification |
| Money movement | Bachs |
| Email delivery | Resend |
| OTP codes | TippyMe MongoDB (hashed) + email transport |

---

## 7. Security boundaries

- Session: httpOnly cookie `tippyme_session` (JWT, 24h). Logout sets `sessionRevokedAt`. Never expose OTP codes or secrets to the client.
- Tip notes are returned only with a confirmation token. Unauthenticated reads get status and amount only.
- Tip `PAID` status is set only via webhook + server-side Bachs verify — never from browser redirects.
- Secrets (`AUTH_*`, `MONGODB_URI`, `BACHS_*`, `RESEND_*`) stay on the Nitro server (`runtimeConfig`), never `NUXT_PUBLIC_*`.
- `/api/health` is process liveness. `/api/ready` checks MongoDB. Docker health checks stay on `/api/health` so a database blip does not restart the container.

---

## 8. Layout

```text
pages/                 Vue routes
server/
  api/                 Nitro /api handlers
  services/            Domain logic (auth, creators, tips, payments, …)
  lib/                 env, auth, errors, rate-limit
  db/                  Mongoose models, client, seed
```
