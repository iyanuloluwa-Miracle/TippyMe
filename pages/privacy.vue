<template>
  <article class="mx-auto max-w-2xl py-4 sm:py-8">
    <header class="mb-8">
      <p class="text-sm font-bold uppercase tracking-wide text-cheer-leaf">
        Legal
      </p>
      <h1 class="mt-2 text-3xl font-bold tracking-tight text-cheer-ink sm:text-4xl">
        Privacy
      </h1>
      <p class="mt-3 text-sm font-semibold text-cheer-ink/80">
          Last updated: September 17, 2026
      </p>
    </header>

    <div class="space-y-6 text-base font-semibold leading-relaxed text-cheer-ink/90">
      <section>
        <h2 class="text-lg font-bold text-cheer-ink">
          Overview
        </h2>
        <p class="mt-2">
          TippyMe collects only what we need to run creator pages, accounts, and support flows. We do not sell personal data.
        </p>
      </section>

      <section>
        <h2 class="text-lg font-bold text-cheer-ink">
          Information we collect
        </h2>
        <ul class="mt-2 list-disc space-y-2 pl-5">
          <li>
            <strong class="font-semibold text-cheer-ink">Creators:</strong>
            email, password (hashed) or Google account id, profile details, social links, tip settings, and optional payout country.
          </li>
          <li>
            <strong class="font-semibold text-cheer-ink">Supporters:</strong>
            email (for checkout), optional name, optional message, tip amount, and payment status from Bachs.
          </li>
          <li>
            <strong class="font-semibold text-cheer-ink">Technical:</strong>
            basic logs needed to operate and secure the service.
          </li>
        </ul>
      </section>

      <section>
        <h2 class="text-lg font-bold text-cheer-ink">
          Payments and financial data
        </h2>
        <p class="mt-2">
          Card and bank payment details are handled by Bachs during checkout. TippyMe does not store full card numbers. We store tip amounts, currency, status, and references needed for confirmations and the creator dashboard. When Bachs payouts are enabled, a platform fee is taken only on destination-charge tips. That fee is shown before checkout.
        </p>
      </section>

      <section>
        <h2 class="text-lg font-bold text-cheer-ink">
          Processors
        </h2>
        <ul class="mt-2 list-disc space-y-2 pl-5">
          <li>Bachs processes payments and Connect payouts.</li>
          <li>Resend sends verification codes, receipts, and account emails.</li>
          <li>Google may be used if you choose Continue with Google.</li>
          <li>Byteship stores profile photos you upload.</li>
          <li>OpenRouter may draft bio or thank-you text when that assist is enabled.</li>
          <li>Frankfurter may supply reference exchange rates for dashboard estimates. Per-currency tip amounts stay the source of truth.</li>
          <li>Sabilytics, when configured, receives aggregated site events without supporter emails or payment identifiers.</li>
        </ul>
      </section>

      <section>
        <h2 class="text-lg font-bold text-cheer-ink">
          Messages and anonymity
        </h2>
        <p class="mt-2">
          Messages you leave with a tip may be shown to the creator. If you tip anonymously, your name is not shown on the public page or in public-facing message views.
        </p>
      </section>

      <section>
        <h2 class="text-lg font-bold text-cheer-ink">
          Analytics and tip-page views
        </h2>
        <p class="mt-2">
          When configured, TippyMe uses Sabilytics for aggregated website traffic and product events (such as tip page opens, link copy/share, and checkout starts). Event payloads do not include supporter emails or other payment identifiers.
        </p>
        <p class="mt-2">
          TippyMe also stores anonymous tip-page view counts so creators can see how often their public link is opened. These counts do not include IP addresses, device fingerprints, or visitor identity.
        </p>
      </section>

      <section>
        <h2 class="text-lg font-bold text-cheer-ink">
          Contact
        </h2>
        <p class="mt-2">
          Privacy questions:
          <a
            href="mailto:iyanudina@gmail.com"
            class="font-semibold text-cheer-leaf underline-offset-2 hover:underline"
          >iyanudina@gmail.com</a>.
        </p>
      </section>
    </div>
  </article>
</template>

<script setup lang="ts">
useHead({
  title: 'Privacy — TippyMe',
  meta: [
    {
      name: 'description',
      content:
        'How TippyMe handles creator and supporter information, including payments processed through Bachs.',
    },
  ],
});
</script>
