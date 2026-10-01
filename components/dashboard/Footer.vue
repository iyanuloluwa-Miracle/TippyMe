<template>
  <footer class="dashboard-footer" aria-label="TippyMe dashboard footer">
    <div class="footer-inner">
      <div class="footer-signoff">
        <span class="footer-heart" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M12 20s-8-4.7-8-10.2C4 6.9 6 5 8.5 5c1.5 0 2.7.7 3.5 1.8C12.8 5.7 14 5 15.5 5 18 5 20 6.9 20 9.8 20 15.3 12 20 12 20Z" fill="currentColor" />
            <path d="M7 9.5c0-1 .6-1.7 1.5-1.7" stroke="white" stroke-width="1.5" stroke-linecap="round" />
          </svg>
          <span class="heart-spark">✦</span>
        </span>
        <div>
          <p class="footer-title">Made with love, by <NuxtLink to="/">TippyMe<span aria-hidden="true">↗</span></NuxtLink></p>
          <p class="footer-note">For the people who keep creating.</p>
        </div>
      </div>
      <p class="footer-encouragement">Your next chapter looks good on you.</p>
    </div>
  </footer>
</template>

<style scoped>
.dashboard-footer {
  width: 100%;
  max-width: 1600px;
  margin: 0 auto;
  padding: 0 32px max(24px, env(safe-area-inset-bottom));
}
.footer-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px 24px;
  padding: 24px 192px 0 0;
  border-top: 1px solid #e2d8ee;
}
.footer-signoff { display: flex; align-items: center; gap: 16px; min-width: 0; }
.footer-heart {
  position: relative;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border: 1px solid #e0d1f1;
  border-radius: 16px;
  color: #7540b4;
  background: linear-gradient(145deg, #fff, #eee5fa);
  box-shadow: 0 3px 8px #7540b408;
  transform: rotate(-6deg);
}
.footer-heart svg { width: 25px; height: 25px; }
.heart-spark { position: absolute; top: -7px; right: -5px; color: #7540b4; font-size: 16px; }
.footer-title { margin: 0; color: #30213f; font-size: 15px; font-weight: 800; line-height: 1.5; }
.footer-title a { display: inline-flex; align-items: baseline; gap: 4px; color: #6d3db0; white-space: nowrap; text-decoration: underline; text-decoration-color: #cbb2e6; text-underline-offset: 4px; }
.footer-title a:hover { color: #512780; text-decoration-color: currentColor; }
.footer-title a:focus-visible { outline: 2px solid #7540b4; outline-offset: 4px; border-radius: 3px; }
.footer-title a span { font-size: 12px; }
.footer-note { margin: 4px 0 0; color: var(--dashboard-text-secondary, #53445f); font-size: 13px; font-weight: 700; line-height: 1.5; }
.footer-encouragement { margin: 0; color: #6d3db0; font-size: 13px; font-weight: 700; line-height: 1.5; }
@media (max-width: 1200px) {
  .dashboard-footer { padding-inline: 24px; }
  .footer-encouragement { display: none; }
}
@media (max-width: 640px) {
  .dashboard-footer { padding: 0 16px calc(96px + env(safe-area-inset-bottom)); }
  .footer-inner { padding: 20px 0 0; }
  .footer-signoff { gap: 12px; }
  .footer-title { font-size: 14px; }
  .footer-note { font-size: 12px; }
}
</style>
