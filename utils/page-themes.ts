export type PageThemeId =
  | 'classic'
  | 'lagos-night'
  | 'dust-road'
  | 'palm-shade'
  | 'studio-ink'
  | 'harbor-mist'
  | 'ember-market'
  | 'soft-dawn'
  | 'concrete-garden';

export interface PageTheme {
  id: PageThemeId;
  name: string;
  tagline: string;
  /** Google Fonts family names to load (display first). */
  fonts: { display: string; body: string; googleQuery: string };
  vars: Record<string, string>;
}

export const PAGE_THEMES: PageTheme[] = [
  {
    id: 'classic',
    name: 'Classic Tippy',
    tagline: 'The original TippyMe studio wash.',
    fonts: {
      display: '"Darker Grotesque", sans-serif',
      body: '"Darker Grotesque", sans-serif',
      googleQuery: 'Darker+Grotesque:wght@400;500;600;700;800',
    },
    vars: {
      '--page-bg': 'linear-gradient(165deg, #f7f2ff 0%, #efe6fb 42%, #faf7ff 100%)',
      '--page-surface': '#ffffffee',
      '--page-ink': '#261b38',
      '--page-muted': '#6d5b82',
      '--page-accent': '#7c4ac0',
      '--page-cta': '#603197',
      '--page-cta-text': '#ffffff',
      '--page-border': '#e7dfee',
      '--page-glow': 'radial-gradient(ellipse at 20% 0%, #855cc933, transparent 55%)',
      '--page-kicker': '#6d3db0',
    },
  },
  {
    id: 'lagos-night',
    name: 'Lagos Night',
    tagline: 'Indigo dusk with neon-warm CTAs.',
    fonts: {
      display: '"Fraunces", Georgia, serif',
      body: '"DM Sans", system-ui, sans-serif',
      googleQuery: 'Fraunces:opsz,wght@9..144,500;700&family=DM+Sans:wght@400;500;700',
    },
    vars: {
      '--page-bg': 'linear-gradient(160deg, #0b1026 0%, #1a1440 45%, #2a1854 100%)',
      '--page-surface': '#16122fd9',
      '--page-ink': '#f4efff',
      '--page-muted': '#b7a8d4',
      '--page-accent': '#ffb454',
      '--page-cta': '#ff8a3d',
      '--page-cta-text': '#1a0f08',
      '--page-border': '#3d2f6a',
      '--page-glow': 'radial-gradient(ellipse at 80% 10%, #ff8a3d33, transparent 50%)',
      '--page-kicker': '#ffc887',
    },
  },
  {
    id: 'dust-road',
    name: 'Dust Road',
    tagline: 'Sun-baked clay and deep earth ink.',
    fonts: {
      display: '"Literata", Georgia, serif',
      body: '"Source Sans 3", system-ui, sans-serif',
      googleQuery: 'Literata:wght@500;700&family=Source+Sans+3:wght@400;600;700',
    },
    vars: {
      '--page-bg': 'linear-gradient(145deg, #f3e0c8 0%, #e8c9a0 50%, #d9b07a 100%)',
      '--page-surface': '#fff8edd9',
      '--page-ink': '#3b2414',
      '--page-muted': '#7a5640',
      '--page-accent': '#b85c38',
      '--page-cta': '#8f3d1f',
      '--page-cta-text': '#fff6ee',
      '--page-border': '#d4b48f',
      '--page-glow': 'radial-gradient(ellipse at 10% 20%, #ffffff66, transparent 45%)',
      '--page-kicker': '#8f3d1f',
    },
  },
  {
    id: 'palm-shade',
    name: 'Palm Shade',
    tagline: 'Cool green canopy and soft light.',
    fonts: {
      display: '"Libre Baskerville", Georgia, serif',
      body: '"Nunito Sans", system-ui, sans-serif',
      googleQuery: 'Libre+Baskerville:wght@400;700&family=Nunito+Sans:wght@400;600;700',
    },
    vars: {
      '--page-bg': 'linear-gradient(170deg, #e8f3ea 0%, #cfe6d4 40%, #a8d0b8 100%)',
      '--page-surface': '#f7fcf8ee',
      '--page-ink': '#143028',
      '--page-muted': '#45685a',
      '--page-accent': '#1f7a5c',
      '--page-cta': '#0f5c44',
      '--page-cta-text': '#f3fff9',
      '--page-border': '#b7d6c4',
      '--page-glow': 'radial-gradient(ellipse at 70% 0%, #ffffff88, transparent 50%)',
      '--page-kicker': '#1f7a5c',
    },
  },
  {
    id: 'studio-ink',
    name: 'Studio Ink',
    tagline: 'High-contrast editorial black and paper.',
    fonts: {
      display: '"Playfair Display", Georgia, serif',
      body: '"Karla", system-ui, sans-serif',
      googleQuery: 'Playfair+Display:wght@500;700&family=Karla:wght@400;600;700',
    },
    vars: {
      '--page-bg': 'linear-gradient(180deg, #f4f1ea 0%, #e7e2d6 100%)',
      '--page-surface': '#fffcf7f2',
      '--page-ink': '#121212',
      '--page-muted': '#5c5a56',
      '--page-accent': '#c45c26',
      '--page-cta': '#111111',
      '--page-cta-text': '#f7f4ee',
      '--page-border': '#d7d1c4',
      '--page-glow': 'radial-gradient(ellipse at 50% 0%, #0000000d, transparent 55%)',
      '--page-kicker': '#c45c26',
    },
  },
  {
    id: 'harbor-mist',
    name: 'Harbor Mist',
    tagline: 'Coastal blue-grey with salt-light air.',
    fonts: {
      display: '"Cormorant Garamond", Georgia, serif',
      body: '"Work Sans", system-ui, sans-serif',
      googleQuery: 'Cormorant+Garamond:wght@500;700&family=Work+Sans:wght@400;600;700',
    },
    vars: {
      '--page-bg': 'linear-gradient(155deg, #e7eef4 0%, #c9d8e4 48%, #a9c0d2 100%)',
      '--page-surface': '#f5f9fcee',
      '--page-ink': '#1a2a36',
      '--page-muted': '#4f6675',
      '--page-accent': '#2f6f8f',
      '--page-cta': '#1e5672',
      '--page-cta-text': '#f3fafc',
      '--page-border': '#b8cad6',
      '--page-glow': 'radial-gradient(ellipse at 90% 15%, #ffffff99, transparent 48%)',
      '--page-kicker': '#2f6f8f',
    },
  },
  {
    id: 'ember-market',
    name: 'Ember Market',
    tagline: 'Market-stall warmth and spice accents.',
    fonts: {
      display: '"Bitter", Georgia, serif',
      body: '"Outfit", system-ui, sans-serif',
      googleQuery: 'Bitter:wght@500;700&family=Outfit:wght@400;600;700',
    },
    vars: {
      '--page-bg': 'linear-gradient(150deg, #2a1410 0%, #4a1f14 40%, #7a2e18 100%)',
      '--page-surface': '#3a1c14e6',
      '--page-ink': '#ffe8d6',
      '--page-muted': '#d4a88c',
      '--page-accent': '#f0a202',
      '--page-cta': '#e85d04',
      '--page-cta-text': '#1a0a06',
      '--page-border': '#6b3424',
      '--page-glow': 'radial-gradient(ellipse at 15% 10%, #f0a20244, transparent 50%)',
      '--page-kicker': '#f0a202',
    },
  },
  {
    id: 'soft-dawn',
    name: 'Soft Dawn',
    tagline: 'Rose light and quiet morning calm.',
    fonts: {
      display: '"Newsreader", Georgia, serif',
      body: '"Manrope", system-ui, sans-serif',
      googleQuery: 'Newsreader:wght@500;700&family=Manrope:wght@400;600;700',
    },
    vars: {
      '--page-bg': 'linear-gradient(165deg, #fff1f0 0%, #fde2e4 45%, #fad2e1 100%)',
      '--page-surface': '#fffafbee',
      '--page-ink': '#3d1f2b',
      '--page-muted': '#8a5a6c',
      '--page-accent': '#c9184a',
      '--page-cta': '#a4133c',
      '--page-cta-text': '#fff7fa',
      '--page-border': '#f0c8d4',
      '--page-glow': 'radial-gradient(ellipse at 30% 0%, #ffffffaa, transparent 50%)',
      '--page-kicker': '#c9184a',
    },
  },
  {
    id: 'concrete-garden',
    name: 'Concrete Garden',
    tagline: 'Brutalist stone with living green.',
    fonts: {
      display: '"Space Grotesk", system-ui, sans-serif',
      body: '"IBM Plex Sans", system-ui, sans-serif',
      googleQuery: 'Space+Grotesk:wght@500;700&family=IBM+Plex+Sans:wght@400;600;700',
    },
    vars: {
      '--page-bg': 'linear-gradient(180deg, #d9d6d0 0%, #c4c0b8 55%, #a8b5a0 100%)',
      '--page-surface': '#eceae4f0',
      '--page-ink': '#1c1c1a',
      '--page-muted': '#5a5c56',
      '--page-accent': '#3f6f4a',
      '--page-cta': '#2c4f34',
      '--page-cta-text': '#f2f7f1',
      '--page-border': '#b0aea6',
      '--page-glow': 'radial-gradient(ellipse at 60% 0%, #ffffff55, transparent 50%)',
      '--page-kicker': '#3f6f4a',
    },
  },
];

const THEME_IDS = new Set(PAGE_THEMES.map((t) => t.id));

export function normalizePageThemeId(raw: unknown): PageThemeId {
  if (typeof raw === 'string' && THEME_IDS.has(raw as PageThemeId)) {
    return raw as PageThemeId;
  }
  return 'classic';
}

export function getPageTheme(id: unknown): PageTheme {
  const normalized = normalizePageThemeId(id);
  return PAGE_THEMES.find((t) => t.id === normalized) ?? PAGE_THEMES[0]!;
}

export function pageThemeCssVars(id: unknown): Record<string, string> {
  const theme = getPageTheme(id);
  return {
    ...theme.vars,
    '--page-font-display': theme.fonts.display,
    '--page-font-body': theme.fonts.body,
  };
}
