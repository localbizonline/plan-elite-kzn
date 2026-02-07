// ============================================================================
// uniqueness-presets.mjs
// ============================================================================
// Maps design directions to CSS variation axes and compatible alternatives.
// Used by apply-uniqueness.mjs to select per-build visual tweaks.
//
// Each axis has a set of options. Each design direction maps to a default
// selection. The "jitter" system randomly swaps 2-3 axes to compatible
// alternatives so that two builds with the same direction still look different.
// ============================================================================

/**
 * All available CSS variation axes and their options.
 * Each option maps to concrete CSS that apply-uniqueness.mjs generates.
 */
export const CSS_AXES = {
  borderRadius: {
    options: ['sharp', 'soft', 'rounded', 'pill'],
    description: 'Border radius on cards, buttons, badges, icon containers',
  },
  shadowStyle: {
    options: ['none', 'subtle', 'elevated', 'dramatic'],
    description: 'Box-shadow depth on cards and sections',
  },
  sectionSpacing: {
    options: ['compact', 'standard', 'generous'],
    description: 'Vertical padding on major sections',
  },
  cardStyle: {
    options: ['flat', 'elevated', 'bordered', 'glass'],
    description: 'Visual treatment of card containers',
  },
  headingCase: {
    options: ['uppercase', 'title-case', 'normal'],
    description: 'Text transform on h1-h4',
  },
  headingWeight: {
    options: ['black', 'bold', 'medium'],
    description: 'Font weight on headings (900, 700, 500)',
  },
  headingSizeScale: {
    options: ['compact', 'standard', 'bold'],
    description: 'Font size ratio across heading levels',
  },
  letterSpacing: {
    options: ['tight', 'normal', 'wide'],
    description: 'Letter spacing on headings',
  },
  headingHighlight: {
    options: ['none', 'accent-color', 'underline-brush', 'background-mark'],
    description: 'Highlight style on one key word in major headings',
  },
  buttonStyle: {
    options: ['solid', 'outline', 'pill', 'ghost'],
    description: 'CTA button appearance',
  },
  hoverEffect: {
    options: ['scale', 'lift', 'glow', 'underline'],
    description: 'Hover state on interactive elements',
  },
  sectionDividers: {
    options: ['none', 'line', 'accent-line'],
    description: 'Divider between major sections',
  },
  imageShape: {
    options: ['default', 'rounded-lg', 'blob', 'clipped'],
    description: 'Shape treatment on gallery/service/headshot images',
  },
  accentBorders: {
    options: ['none', 'top-bar', 'left-bar', 'bottom-underline'],
    description: 'Accent border on cards and section headings',
  },
  backgroundPattern: {
    options: ['solid', 'gradient', 'dots'],
    description: 'Background treatment on surface sections',
  },
  heroTitleDecoration: {
    options: ['none', 'underline-accent', 'top-rule', 'side-lines', 'bracket', 'badge-frame', 'overline-underline'],
    description: 'Decorative element around the hero H1 (lines, brackets, frames)',
  },
  sectionDividerShape: {
    options: ['none', 'wave', 'angle', 'curve', 'zigzag', 'arrow', 'torn'],
    description: 'SVG shape divider at bottom of hero section',
  },
  ctaBannerVariant: {
    options: ['full-bleed-accent', 'split-image', 'stats-bar', 'testimonial-cta', 'emergency-urgent', 'map-cta'],
    description: 'Pre-footer CTA banner visual variant',
  },
};

/**
 * Design direction presets.
 * Each direction maps to a default CSS axis selection.
 */
export const DIRECTION_PRESETS = {
  Industrial: {
    borderRadius: 'sharp',
    shadowStyle: 'none',
    sectionSpacing: 'standard',
    cardStyle: 'bordered',
    headingCase: 'uppercase',
    headingWeight: 'black',
    headingSizeScale: 'bold',
    letterSpacing: 'wide',
    headingHighlight: 'none',
    buttonStyle: 'solid',
    hoverEffect: 'lift',
    sectionDividers: 'accent-line',
    imageShape: 'default',
    accentBorders: 'top-bar',
    backgroundPattern: 'solid',
    heroTitleDecoration: 'underline-accent',
    sectionDividerShape: 'angle',
    ctaBannerVariant: 'full-bleed-accent',
  },
  Brutalist: {
    borderRadius: 'sharp',
    shadowStyle: 'none',
    sectionSpacing: 'standard',
    cardStyle: 'flat',
    headingCase: 'uppercase',
    headingWeight: 'black',
    headingSizeScale: 'bold',
    letterSpacing: 'wide',
    headingHighlight: 'background-mark',
    buttonStyle: 'ghost',
    hoverEffect: 'underline',
    sectionDividers: 'accent-line',
    imageShape: 'clipped',
    accentBorders: 'left-bar',
    backgroundPattern: 'solid',
    heroTitleDecoration: 'bracket',
    sectionDividerShape: 'torn',
    ctaBannerVariant: 'emergency-urgent',
  },
  'Tech/Modern': {
    borderRadius: 'soft',
    shadowStyle: 'subtle',
    sectionSpacing: 'compact',
    cardStyle: 'glass',
    headingCase: 'normal',
    headingWeight: 'medium',
    headingSizeScale: 'standard',
    letterSpacing: 'tight',
    headingHighlight: 'underline-brush',
    buttonStyle: 'outline',
    hoverEffect: 'glow',
    sectionDividers: 'line',
    imageShape: 'rounded-lg',
    accentBorders: 'bottom-underline',
    backgroundPattern: 'gradient',
    heroTitleDecoration: 'side-lines',
    sectionDividerShape: 'curve',
    ctaBannerVariant: 'stats-bar',
  },
  Playful: {
    borderRadius: 'rounded',
    shadowStyle: 'elevated',
    sectionSpacing: 'generous',
    cardStyle: 'elevated',
    headingCase: 'title-case',
    headingWeight: 'bold',
    headingSizeScale: 'bold',
    letterSpacing: 'normal',
    headingHighlight: 'accent-color',
    buttonStyle: 'pill',
    hoverEffect: 'scale',
    sectionDividers: 'none',
    imageShape: 'blob',
    accentBorders: 'none',
    backgroundPattern: 'dots',
    heroTitleDecoration: 'badge-frame',
    sectionDividerShape: 'wave',
    ctaBannerVariant: 'testimonial-cta',
  },
  Organic: {
    borderRadius: 'rounded',
    shadowStyle: 'subtle',
    sectionSpacing: 'generous',
    cardStyle: 'elevated',
    headingCase: 'title-case',
    headingWeight: 'bold',
    headingSizeScale: 'standard',
    letterSpacing: 'normal',
    headingHighlight: 'accent-color',
    buttonStyle: 'solid',
    hoverEffect: 'scale',
    sectionDividers: 'none',
    imageShape: 'blob',
    accentBorders: 'none',
    backgroundPattern: 'gradient',
    heroTitleDecoration: 'top-rule',
    sectionDividerShape: 'wave',
    ctaBannerVariant: 'split-image',
  },
  Editorial: {
    borderRadius: 'soft',
    shadowStyle: 'none',
    sectionSpacing: 'generous',
    cardStyle: 'flat',
    headingCase: 'normal',
    headingWeight: 'medium',
    headingSizeScale: 'compact',
    letterSpacing: 'tight',
    headingHighlight: 'underline-brush',
    buttonStyle: 'ghost',
    hoverEffect: 'underline',
    sectionDividers: 'line',
    imageShape: 'rounded-lg',
    accentBorders: 'bottom-underline',
    backgroundPattern: 'solid',
    heroTitleDecoration: 'overline-underline',
    sectionDividerShape: 'none',
    ctaBannerVariant: 'testimonial-cta',
  },
  Luxury: {
    borderRadius: 'soft',
    shadowStyle: 'dramatic',
    sectionSpacing: 'generous',
    cardStyle: 'bordered',
    headingCase: 'normal',
    headingWeight: 'medium',
    headingSizeScale: 'standard',
    letterSpacing: 'tight',
    headingHighlight: 'underline-brush',
    buttonStyle: 'solid',
    hoverEffect: 'lift',
    sectionDividers: 'accent-line',
    imageShape: 'rounded-lg',
    accentBorders: 'bottom-underline',
    backgroundPattern: 'gradient',
    heroTitleDecoration: 'side-lines',
    sectionDividerShape: 'curve',
    ctaBannerVariant: 'stats-bar',
  },
  'Clean Professional': {
    borderRadius: 'soft',
    shadowStyle: 'subtle',
    sectionSpacing: 'standard',
    cardStyle: 'elevated',
    headingCase: 'title-case',
    headingWeight: 'bold',
    headingSizeScale: 'standard',
    letterSpacing: 'normal',
    headingHighlight: 'none',
    buttonStyle: 'solid',
    hoverEffect: 'lift',
    sectionDividers: 'line',
    imageShape: 'default',
    accentBorders: 'top-bar',
    backgroundPattern: 'solid',
    heroTitleDecoration: 'underline-accent',
    sectionDividerShape: 'none',
    ctaBannerVariant: 'full-bleed-accent',
  },
};

/**
 * Compatible alternatives for jitter.
 * For each axis, lists which options are acceptable swaps per direction "feel".
 * Grouped by visual feel: "hard" (sharp/industrial) vs "soft" (rounded/organic).
 */
const JITTER_COMPATIBLE = {
  borderRadius: {
    hard: ['sharp', 'soft'],
    soft: ['soft', 'rounded', 'pill'],
  },
  shadowStyle: {
    hard: ['none', 'subtle'],
    soft: ['subtle', 'elevated', 'dramatic'],
  },
  cardStyle: {
    hard: ['flat', 'bordered', 'glass'],
    soft: ['elevated', 'bordered', 'glass'],
  },
  buttonStyle: {
    hard: ['solid', 'outline', 'ghost'],
    soft: ['solid', 'pill', 'outline'],
  },
  hoverEffect: {
    hard: ['lift', 'glow', 'underline'],
    soft: ['scale', 'lift', 'glow'],
  },
  headingHighlight: {
    hard: ['none', 'background-mark', 'accent-color'],
    soft: ['none', 'accent-color', 'underline-brush'],
  },
  imageShape: {
    hard: ['default', 'clipped', 'rounded-lg'],
    soft: ['default', 'rounded-lg', 'blob'],
  },
  accentBorders: {
    hard: ['none', 'top-bar', 'left-bar'],
    soft: ['none', 'top-bar', 'bottom-underline'],
  },
  heroTitleDecoration: {
    hard: ['none', 'underline-accent', 'bracket', 'overline-underline'],
    soft: ['none', 'underline-accent', 'top-rule', 'side-lines', 'badge-frame'],
  },
  sectionDividerShape: {
    hard: ['none', 'angle', 'zigzag', 'torn', 'arrow'],
    soft: ['none', 'wave', 'curve', 'arrow'],
  },
  ctaBannerVariant: {
    hard: ['full-bleed-accent', 'stats-bar', 'emergency-urgent'],
    soft: ['full-bleed-accent', 'split-image', 'testimonial-cta', 'map-cta'],
  },
};

const HARD_DIRECTIONS = ['Industrial', 'Brutalist', 'Tech/Modern'];

/**
 * Apply random jitter to a preset selection.
 * Randomly swaps 3-5 axes to compatible alternatives.
 * Uses a seeded approach based on company name for reproducibility.
 *
 * @param {Record<string, string>} selection - Current axis selections
 * @param {string} direction - Design direction name
 * @param {string} seed - Seed string (company name) for reproducible randomness
 * @returns {{ selection: Record<string, string>, jitter: string[] }}
 */
export function applyJitter(selection, direction, seed) {
  const feel = HARD_DIRECTIONS.includes(direction) ? 'hard' : 'soft';
  const jitterAxes = Object.keys(JITTER_COMPATIBLE);
  const jittered = { ...selection };
  const applied = [];

  // Simple seeded random from string
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  const seededRandom = () => {
    hash = (hash * 1103515245 + 12345) & 0x7fffffff;
    return (hash % 1000) / 1000;
  };

  // Shuffle axes and pick 3-5 (increased from 2-3 for more variation)
  const shuffled = [...jitterAxes].sort(() => seededRandom() - 0.5);
  const count = 3 + Math.floor(seededRandom() * 3); // 3, 4, or 5

  for (let i = 0; i < Math.min(count, shuffled.length); i++) {
    const axis = shuffled[i];
    const compatible = JITTER_COMPATIBLE[axis][feel];
    const current = jittered[axis];

    // Pick a different option from compatible list
    const alternatives = compatible.filter((opt) => opt !== current);
    if (alternatives.length > 0) {
      const pick = alternatives[Math.floor(seededRandom() * alternatives.length)];
      jittered[axis] = pick;
      applied.push(`${axis}:${current}->${pick}`);
    }
  }

  return { selection: jittered, jitter: applied };
}

/**
 * Get the full axis selection for a given design direction with optional jitter.
 *
 * @param {string} direction - Design direction (e.g., "Industrial", "Playful")
 * @param {string} [seed] - Optional seed for jitter (company name)
 * @returns {{ selection: Record<string, string>, direction: string, jitter: string[] }}
 */
export function getPreset(direction, seed) {
  // Normalize direction name
  const normalized = Object.keys(DIRECTION_PRESETS).find(
    (k) => k.toLowerCase() === direction.toLowerCase()
  );

  const preset = normalized
    ? DIRECTION_PRESETS[normalized]
    : DIRECTION_PRESETS['Clean Professional']; // fallback

  const dirName = normalized || 'Clean Professional';

  if (seed) {
    const { selection, jitter } = applyJitter(preset, dirName, seed);
    return { selection, direction: dirName, jitter };
  }

  return { selection: { ...preset }, direction: dirName, jitter: [] };
}
