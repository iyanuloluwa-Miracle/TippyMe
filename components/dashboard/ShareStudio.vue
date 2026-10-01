<template>
  <section class="share-studio" :class="{ 'share-studio--dark': theme === 'dark' }" aria-labelledby="share-studio-title">
    <header class="studio-heading">
      <div>
        <p class="eyebrow">A little link. A lot of possibility.</p>
        <h2 id="share-studio-title">Take your support link further.</h2>
        <p>Make it easy for people to support you, wherever they find your work.</p>
      </div>
      <span class="heading-icon" aria-hidden="true">↗</span>
    </header>

    <div class="link-bar">
      <div class="link-text"><span>Your TippyMe link</span><a :href="publicUrl" target="_blank" rel="noopener noreferrer">{{ displayUrl }} <span aria-hidden="true">↗</span></a></div>
      <button type="button" class="secondary-button" @click="copy(publicUrl, 'link')">{{ copied === 'link' ? '✓ Copied!' : 'Copy link' }}</button>
    </div>

    <div class="destination-picker" role="group" aria-label="Choose where to share">
      <button v-for="destination in destinations" :key="destination.id" type="button" :aria-pressed="active === destination.id" :class="{ selected: active === destination.id }" @click="selectDestination(destination.id)">
        <span class="destination-icon" aria-hidden="true">{{ destination.icon }}</span>
        <span><strong>{{ destination.label }}</strong><small>{{ destination.description }}</small></span>
      </button>
    </div>

    <div class="studio-body">
      <div class="preview-column">
        <div class="section-label"><span>{{ active === 'sponsor' ? 'Example placement' : 'Live preview' }}</span><span class="preview-dot" aria-hidden="true" /></div>
        <div class="preview-stage" :class="{ 'preview-stage--embed': active === 'website' }">
          <div v-if="active === 'website'" class="browser-preview">
            <div class="browser-chrome"><span aria-hidden="true">● ● ●</span><span>your-website.com</span><span aria-hidden="true">↗</span></div>
            <iframe :src="embedUrl" :title="`Preview: Support ${displayName}`" loading="lazy" class="embed-preview" />
          </div>
          <div v-else-if="active === 'readme'" class="readme-preview">
            <div class="mock-file"><span aria-hidden="true">☰</span> README.md</div>
            <div class="mock-content"><span class="mock-kicker">MADE WITH CARE</span><h3>Enjoying my work?</h3><p>Your support helps me keep creating.</p><a :href="publicUrl" target="_blank" rel="noopener noreferrer" class="badge-link"><img src="/badges/support-me.svg" alt="Support me on TippyMe" width="260" height="48"></a></div>
          </div>
          <div v-else class="sponsor-preview"><div class="mock-file">About this project</div><div class="mock-content"><div class="skeleton-line" /><div class="skeleton-line short" /><h3>Sponsor this project</h3><a :href="publicUrl" target="_blank" rel="noopener noreferrer" class="sponsor-button"><span aria-hidden="true">♡</span> Sponsor</a><p>{{ displayUrl }}</p></div></div>
        </div>
        <p class="preview-caption">{{ active === 'website' ? 'Your published page, ready to live on your website.' : active === 'readme' ? 'A small badge that opens your public support page.' : 'Give visitors a direct route from your repository to your page.' }}</p>
        <a class="text-link" :href="publicUrl" target="_blank" rel="noopener noreferrer">Open your support page <span aria-hidden="true">↗</span></a>
      </div>

      <div class="setup-column">
        <div class="section-label">{{ active === 'website' ? 'Add to your website' : active === 'readme' ? 'Add to your README' : 'Add a Sponsor button' }}</div>
        <h3>{{ active === 'website' ? 'Your page. Anywhere.' : active === 'readme' ? 'Turn appreciation into support.' : 'Let your community give back.' }}</h3>
        <p class="setup-description">{{ active === 'website' ? 'Add a support card to your portfolio, blog, or any site that accepts HTML embeds.' : active === 'readme' ? 'Add a support badge to your GitHub profile or project. Choose the format that works for you.' : 'Add your TippyMe link to the funding options on your GitHub repository.' }}</p>

        <div v-if="active === 'readme'" class="format-picker" role="group" aria-label="Code format"><button v-for="option in ['Markdown', 'HTML'] as const" :key="option" type="button" :aria-pressed="format === option" :class="{ selected: format === option }" @click="format = option; resetFeedback()">{{ option }}</button></div>

        <div class="code-block"><div class="code-heading"><span>{{ codeLabel }}</span><span>Ready to paste</span></div><textarea ref="codeField" :value="snippet" readonly spellcheck="false" :aria-label="`${codeLabel} snippet`" @focus="selectCode" /></div>
        <button type="button" class="primary-button" @click="copy(snippet, 'snippet')"><span aria-hidden="true">{{ copied === 'snippet' ? '✓' : '⧉' }}</span> {{ copied === 'snippet' ? 'Copied to clipboard' : `Copy ${active === 'sponsor' ? 'configuration' : active === 'readme' ? format : 'embed code'}` }}</button>
        <p class="copy-feedback" role="status">{{ feedback }}</p>

        <ol class="setup-steps">
          <template v-if="active === 'website'"><li>Copy the embed code above.</li><li>Paste it into an HTML or embed block on your site.</li><li>Publish your changes. You’re ready for support.</li></template>
          <template v-else-if="active === 'readme'"><li>Open your profile or project’s <code>README.md</code>.</li><li>Paste the badge where you want it to appear.</li><li>Commit your changes to make it live.</li></template>
          <template v-else><li>Create <code>.github/FUNDING.yml</code> in your repository.</li><li>Paste the configuration and commit to your default branch.</li><li>Enable <strong>Sponsorships</strong> in your repository settings.</li></template>
        </ol>
      </div>
    </div>
    <footer class="studio-footer"><span aria-hidden="true">✦</span> One destination for every bit of support. All links lead to your TippyMe page.</footer>
  </section>
</template>

<script setup lang="ts">
type Destination = 'website' | 'readme' | 'sponsor';
const props = withDefaults(defineProps<{ publicPath: string; displayName: string; theme?: 'light' | 'dark' }>(), { theme: 'light' });
const config = useRuntimeConfig();
const requestUrl = useRequestURL();
const active = ref<Destination>('website');
const format = ref<'Markdown' | 'HTML'>('Markdown');
const copied = ref('');
const feedback = ref('');
const codeField = ref<HTMLTextAreaElement | null>(null);
let feedbackTimer: ReturnType<typeof setTimeout> | undefined;
const destinations: { id: Destination; icon: string; label: string; description: string }[] = [
  { id: 'website', icon: '</>', label: 'Website', description: 'Embed your support card' },
  { id: 'readme', icon: '◈', label: 'GitHub README', description: 'Add a support badge' },
  { id: 'sponsor', icon: '♡', label: 'GitHub Sponsor', description: 'Support from your repo' },
];
const origin = computed(() => String(config.public.appUrl || requestUrl.origin).replace(/\/+$/, ''));
const publicUrl = computed(() => `${origin.value}${props.publicPath}`);
const displayUrl = computed(() => publicUrl.value.replace(/^https?:\/\//, ''));
const embedUrl = computed(() => `${origin.value}/embed${props.publicPath}`);
const badgeUrl = computed(() => `${origin.value}/badges/support-me.svg`);
const escapeAttribute = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const codeLabel = computed(() => active.value === 'sponsor' ? '.github/FUNDING.yml' : active.value === 'website' ? 'HTML embed' : format.value === 'Markdown' ? 'README.md' : 'HTML badge');
const snippet = computed(() => {
  if (active.value === 'website') return `<iframe\n  src="${escapeAttribute(embedUrl.value)}"\n  title="${escapeAttribute(`Support ${props.displayName}`)}"\n  width="360" height="320"\n  style="border:0;max-width:100%"\n  loading="lazy"\n></iframe>`;
  if (active.value === 'sponsor') return `# .github/FUNDING.yml\ncustom: [${JSON.stringify(publicUrl.value)}]\n`;
  if (format.value === 'Markdown') return `[![Support me on TippyMe](${badgeUrl.value})](${publicUrl.value})`;
  return `<a href="${escapeAttribute(publicUrl.value)}" target="_blank" rel="noopener noreferrer">\n  <img src="${escapeAttribute(badgeUrl.value)}"\n    alt="Support me on TippyMe"\n    width="260" height="48" />\n</a>`;
});
function resetFeedback() { clearTimeout(feedbackTimer); copied.value = ''; feedback.value = ''; }
function selectDestination(id: Destination) { active.value = id; resetFeedback(); }
function selectCode(event: FocusEvent) { (event.target as HTMLTextAreaElement).select(); }
async function copy(value: string, key: string) {
  resetFeedback();
  try {
    await navigator.clipboard.writeText(value);
    copied.value = key;
    feedback.value = key === 'link' ? 'Your support link is copied.' : 'Copied! Follow the steps below to put it live.';
    feedbackTimer = setTimeout(resetFeedback, 4000);
  } catch {
    feedback.value = key === 'link' ? 'Copy the link directly from the address above.' : 'Select the code and copy it manually.';
    if (key === 'snippet') { codeField.value?.focus(); codeField.value?.select(); }
  }
}
onUnmounted(() => clearTimeout(feedbackTimer));
</script>

<style scoped>
.share-studio { margin-top: 1.25rem; overflow: hidden; border: 1px solid #e5ddf1; border-radius: 24px; background: #fff; box-shadow: 0 8px 32px #32145c05; }
.studio-heading { display: flex; justify-content: space-between; gap: 16px; padding: 30px 28px 24px; background: radial-gradient(ellipse at top right, #eee6ff, transparent 65%); }
.eyebrow { margin: 0 0 8px; color: #7650bb; font-size: 12px; font-weight: 800; letter-spacing: .09em; text-transform: uppercase; }
.studio-heading h2 { margin: 0; font-size: clamp(26px, 3vw, 32px); line-height: 1.1; letter-spacing: -.035em; }
.studio-heading p:last-child { margin: 10px 0 0; color: #756b83; font-size: 15px; line-height: 1.45; }
.heading-icon { display: grid; place-items: center; flex-shrink: 0; width: 46px; height: 46px; border: 1px solid #ddcffa; border-radius: 15px; color: #7546ca; font-size: 28px; background: #f5efff; }
.link-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 0 28px 24px; padding: 13px 16px; border: 1px solid #e9e2f3; border-radius: 13px; background: #fcfaff; }
.link-text { min-width: 0; }.link-text > span { display: block; font-size: 12px; color: #7b708a; }.link-text a { display: block; overflow-wrap: anywhere; font-size: 16px; font-weight: 800; }.link-text a span { color: #8656d8; }
.secondary-button { flex-shrink: 0; border: 1px solid #dfd6ed; border-radius: 9px; background: white; padding: 8px 13px; font-size: 13px; }
.destination-picker { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; padding: 0 28px 24px; }
.destination-picker button { display: flex; align-items: center; gap: 10px; padding: 13px 10px; border: 1px solid #e9e3ef; border-radius: 12px; text-align: left; transition: background .15s, border-color .15s; }
.destination-picker button.selected { border-color: #a27bdf; background: #f6f0ff; box-shadow: inset 0 0 0 1px #a27bdf; }
.destination-icon { color: #8055c4; font-size: 20px; font-weight: 800; }.destination-picker strong { display: block; font-size: 14px; line-height: 1.25; }.destination-picker small { display: block; margin-top: 3px; font-size: 12px; line-height: 1.25; color: #80738f; }
.studio-body { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); border-top: 1px solid #eee8f4; }
.preview-column { padding: 24px; background: #fcfaff; border-right: 1px solid #eee8f4; }.setup-column { min-width: 0; padding: 24px; }
.section-label { display: flex; align-items: center; gap: 8px; color: #80748d; font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
.preview-dot { width: 6px; height: 6px; border-radius: 50%; background: #72ad86; }
.preview-stage { display: flex; align-items: center; justify-content: center; min-height: 300px; padding: 22px 14px; margin-top: 14px; border: 1px solid #e7dff0; border-radius: 14px; background-color: #f2ecf9; background-image: radial-gradient(#cfc0e0 .8px, transparent .8px); background-size: 12px 12px; }
.browser-preview, .readme-preview, .sponsor-preview { width: 100%; min-width: 0; overflow: hidden; border: 1px solid #e5dfed; border-radius: 10px; background: white; box-shadow: 0 12px 28px #39235410; }
.browser-chrome { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 10px; color: #b4a5c6; border-bottom: 1px solid #eee8f4; font-size: 10px; }.browser-chrome span:nth-child(2) { color: #8d809a; }.embed-preview { display: block; width: 100%; height: 320px; border: 0; }
.mock-file { padding: 12px 16px; background: #faf9fb; border-bottom: 1px solid #eee8f4; color: #6f657a; font-family: monospace; font-size: 11px; }.mock-content { padding: 23px 18px; }.mock-kicker { color: #998aa8; font-size: 9px; font-weight: 800; letter-spacing: .15em; }.mock-content h3 { margin: 7px 0; font-size: 20px; line-height: 1.2; }.mock-content p { margin: 7px 0 20px; color: #84758f; font-size: 13px; overflow-wrap: anywhere; }.badge-link { display: inline-block; max-width: 100%; }.badge-link img { width: 260px; max-width: 100%; height: auto; }.preview-caption { margin: 14px 0 7px; color: #83748f; font-size: 13px; line-height: 1.4; }.text-link { color: #8050c7; font-size: 13px; font-weight: 800; }
.skeleton-line { width: 90%; height: 7px; border-radius: 5px; background: #eae5f0; margin-bottom: 9px; }.skeleton-line.short { width: 60%; margin-bottom: 25px; }.sponsor-button { display: inline-flex; align-items: center; gap: 8px; margin-top: 10px; padding: 5px 15px; border: 1px solid #ded8e7; background: #faf9fb; border-radius: 7px; font-size: 14px; }.sponsor-button span { color: #c85ba8; font-size: 22px; }
.setup-column > h3 { font-size: 21px; margin: 10px 0 8px; line-height: 1.15; letter-spacing: -.025em; }.setup-description { margin: 0 0 18px; color: #80718c; font-size: 14px; line-height: 1.45; }
.format-picker { display: inline-flex; gap: 3px; padding: 3px; background: #f2eef7; border-radius: 8px; margin-bottom: 12px; }.format-picker button { padding: 5px 12px; border-radius: 6px; font-size: 12px; color: #7d6f8c; }.format-picker .selected { background: white; color: #6940a7; box-shadow: 0 1px 4px #34234c15; }
.code-block { border: 1px solid #e7e0ef; overflow: hidden; border-radius: 10px; background: #faf8fd; }.code-heading { display: flex; justify-content: space-between; gap: 6px; padding: 9px 12px; border-bottom: 1px solid #eee8f4; color: #756484; font-size: 11px; }.code-heading span:last-child { color: #9a8aa7; }.code-block textarea { display: block; width: 100%; min-height: 160px; padding: 12px; background: transparent; border: 0; color: #654b80; font-family: monospace; font-size: 11px; line-height: 1.7; resize: vertical; overflow-wrap: anywhere; }
.primary-button { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; margin-top: 12px; padding: 11px; border-radius: 10px; background: #8653df; color: white; font-size: 14px; box-shadow: 0 4px 10px #8553df25; transition: background .15s; }.primary-button:hover { background: #7140c5; }.secondary-button:hover { background: #f6f0ff; }.copy-feedback { min-height: 18px; margin: 6px 0; color: #73559a; font-size: 12px; line-height: 1.4; }
.setup-steps { display: grid; gap: 12px; list-style: none; counter-reset: step; padding: 0; margin: 15px 0 0; }.setup-steps li { position: relative; padding-left: 29px; counter-increment: step; color: #80718c; font-size: 13px; line-height: 1.5; }.setup-steps li::before { content: counter(step); position: absolute; left: 0; top: 0; display: grid; place-items: center; width: 20px; height: 20px; border: 1px solid #e9e0f2; border-radius: 50%; font-size: 10px; color: #895cad; background: #fbf8ff; }.setup-steps code { font-size: 10px; overflow-wrap: anywhere; color: #675078; }
.studio-footer { display: flex; align-items: center; gap: 9px; padding: 14px 28px; border-top: 1px solid #eee8f4; color: #8b7a9a; background: #fdfcfe; font-size: 12px; }.studio-footer span { color: #aa85de; }
button:focus-visible, a:focus-visible, textarea:focus-visible { outline: 2px solid #8653df; outline-offset: 3px; }
@media (max-width: 800px) { .studio-body { grid-template-columns: minmax(0, 1fr); }.preview-column { border-right: 0; border-bottom: 1px solid #eee8f4; }.preview-stage { min-height: 250px; }.browser-preview, .readme-preview, .sponsor-preview { max-width: 360px; }.destination-picker button { flex-direction: column; align-items: flex-start; gap: 5px; } }
@media (max-width: 480px) { .studio-heading { padding: 24px 18px 20px; }.heading-icon { display: none; }.link-bar { margin: 0 18px 18px; padding: 11px; }.link-text a { font-size: 14px; }.destination-picker { padding: 0 18px 20px; gap: 6px; }.destination-picker button { padding: 10px 8px; }.destination-picker strong { font-size: 12px; }.destination-picker small { font-size: 11px; }.preview-column, .setup-column { padding: 20px 18px; }.studio-footer { padding: 14px 18px; } }
@media (prefers-reduced-motion: reduce) { button { transition: none !important; } }
.share-studio--dark { margin-top: 0; background: #251d36; border-color: #e5d5ff1c; color: #f7edff; border-radius: 20px; }
.share-studio--dark .studio-heading { background: radial-gradient(ellipse at top right, #a276d822, transparent 65%); }
.share-studio--dark :is(.eyebrow, .section-label, .text-link) { color: #d7b8fb; }
.share-studio--dark :is(.studio-heading p:last-child, .setup-description, .preview-caption, .setup-steps li, .link-text > span, .destination-picker small, .copy-feedback) { color: #c6b3da; }
.share-studio--dark :is(.link-bar, .secondary-button, .destination-picker button, .format-picker, .code-block, .heading-icon) { background: #1d152b; border-color: #d5b9f52e; color: #eee4ff; }
.share-studio--dark .destination-picker button.selected { background: #a778d520; border-color: #a681d0; box-shadow: inset 0 0 0 1px #a681d0; }
.share-studio--dark :is(.preview-column, .studio-footer) { background: #1f172e; border-color: #e5d5ff1c; color: #bca7d3; }
.share-studio--dark .studio-body, .share-studio--dark .code-heading { border-color: #e5d5ff1c; }.share-studio--dark .preview-stage { background-color: #2e2140; background-image: radial-gradient(#cfc0e012 .8px, transparent .8px); border-color: #d5b9f526; }.share-studio--dark :is(.readme-preview, .sponsor-preview, .browser-preview) { color: #1a1228; }
.share-studio--dark .code-block textarea, .share-studio--dark .setup-steps code, .share-studio--dark .code-heading { color: #d9bff5; }.share-studio--dark .code-heading span:last-child { color: #bdabce; }.share-studio--dark .format-picker .selected { background: #4a315f; color: #f0ddff; }.share-studio--dark .setup-steps li::before { background: #b38ae917; border-color: #b38ae944; color: #d7b8fb; }.share-studio--dark .primary-button { background: #e9ddff; color: #281546; }
</style>
