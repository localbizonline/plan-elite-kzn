// ============================================================================
// enhancement-presets.mjs
// ============================================================================
// Reusable design enhancement patterns organized by category.
// Used by the design-enhancer teammate agent (Phase 7.8) to pick
// aggressive, creative changes based on niche, competitor analysis,
// and business features.
//
// These are NOT CSS-axis micro-tweaks (that's uniqueness-presets.mjs).
// These are structural HTML/CSS overhauls — new components, rewritten
// sections, creative layouts, animations, and visual effects.
// ============================================================================

// ---------------------------------------------------------------------------
// Emergency / urgency niches — services people call in a panic
// ---------------------------------------------------------------------------
const EMERGENCY_NICHES = [
  'plumber', 'plumbing', 'locksmith', 'electrician', 'electrical',
  'pest control', 'towing', 'garage door', 'glass repair', 'burst pipe',
  'drain', 'blocked drain', 'geyser', 'hvac', 'air conditioning',
  'security', 'alarm', 'gate motor', 'fire protection',
];

// ---------------------------------------------------------------------------
// Hero layout presets
// ---------------------------------------------------------------------------
export const HERO_PRESETS = {
  'split-with-form': {
    name: 'Split Hero with Contact Form',
    description: 'Two-column layout — headline + CTAs left, embedded contact form right. Converts better for emergency services.',
    when: 'Emergency niches, high-intent visitors who want to act immediately',
    aggressiveness: 'high',
    cssRequired: [
      `.hero-form-card {
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}
.hero-form-card:focus-within {
  transform: translateY(-4px);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}`,
    ],
    dataRequirements: { services: true },
  },

  'split-with-badges': {
    name: 'Split Hero with Trust Badge Cluster',
    description: 'Two-column — headline left, stacked trust badges + review score right. Good for established businesses.',
    when: 'Businesses with 10+ years, high review scores, multiple certifications',
    aggressiveness: 'medium',
    cssRequired: [],
    dataRequirements: { foundingYear: true, reviews: true },
  },

  'full-bleed-gradient': {
    name: 'Full-Bleed Gradient Overlay',
    description: 'Keep centered layout but replace flat overlay with angled gradient. Add badge cluster below CTA.',
    when: 'Any niche — low-risk improvement over flat overlay',
    aggressiveness: 'low',
    cssRequired: [],
    overlayClass: 'bg-gradient-to-br from-primary/85 via-primary/70 to-primary/55',
    dataRequirements: {},
  },

  'angled-overlay': {
    name: 'Angled Clip-Path Overlay',
    description: 'Diagonal clip-path on hero overlay for a modern, dynamic feel.',
    when: 'Modern/tech niches, differentiation from competitors using flat overlays',
    aggressiveness: 'medium',
    cssRequired: [
      `.hero-overlay-angled {
  clip-path: polygon(0 0, 100% 0, 100% 85%, 0 100%);
}`,
    ],
    dataRequirements: {},
  },
};

// ---------------------------------------------------------------------------
// Component presets — new components to inject into the page
// ---------------------------------------------------------------------------
export const COMPONENT_PRESETS = {
  'google-badge': {
    name: 'Google Review Badge',
    description: 'Google "G" icon + star rating + review count pill. Placed above H1 in hero.',
    componentFile: 'GoogleBadge.astro',
    existsInTemplate: true,
    when: 'reviews.totalReviews > 0',
    placement: 'Above hero H1',
    aggressiveness: 'low',
  },

  'years-badge': {
    name: 'Years in Business Badge',
    description: 'Circular stamp badge with years calculated from foundingYear. Tilted -8deg, dashed inner border.',
    componentFile: 'YearsBadge.astro',
    existsInTemplate: true,
    when: 'foundingYear set and business > 5 years old',
    placement: 'Below hero CTAs (desktop only)',
    aggressiveness: 'low',
  },

  'value-strip': {
    name: 'Value / Pricing Strip',
    description: 'Dark horizontal strip between hero and content showing 3 key value props with icons.',
    componentFile: 'ValueStrip.astro',
    existsInTemplate: true,
    when: 'Business has pricing signals, "Low Cost" feature, or free quotes',
    placement: 'Between Hero and TrustBadges on homepage',
    aggressiveness: 'medium',
    dataShape: {
      field: 'homepage.valueStrip',
      type: 'Array<{ label: string; value: string; icon: string }>',
      example: [
        { label: 'Geyser Replacements', value: 'Free Quotes', icon: '🔥' },
        { label: 'Leak Detection', value: 'From R750', icon: '💧' },
        { label: 'Call-Out Fee', value: 'R0', icon: '📞' },
      ],
    },
  },

  'emergency-bar': {
    name: 'Mobile Emergency Status Bar',
    description: 'Pulsing "Available Now — 24/7 Emergency Service" bar above the mobile action buttons.',
    when: 'Emergency/after-hours niches, "Emergency After Hour Service" feature',
    placement: 'Top of MobileActionBar component',
    aggressiveness: 'medium',
    cssRequired: [
      `.emergency-pulse {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.emergency-pulse::before {
  content: '';
  width: 8px;
  height: 8px;
  background: #22c55e;
  border-radius: 50%;
  animation: pulse-dot 2s ease-in-out infinite;
}
@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.5); }
}`,
    ],
  },

  'price-tags': {
    name: 'Service Card Price Tag Ribbons',
    description: 'Angled ribbon badge on service cards showing price/quote info. Uses clip-path for arrow shape.',
    when: 'Services have pricing data or "Free Quote" messaging',
    placement: 'Top-right of each service card',
    aggressiveness: 'medium',
    cssRequired: [
      `.service-card__price-tag {
  position: absolute;
  top: 12px;
  right: -8px;
  background: var(--color-accent);
  color: white;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 0.8rem;
  padding: 5px 14px 5px 10px;
  clip-path: polygon(8px 0, 100% 0, 100% 100%, 8px 100%, 0 50%);
  z-index: 10;
}`,
    ],
    dataShape: {
      field: 'services[].priceTag',
      type: 'string (optional)',
      example: 'Free Quote',
    },
  },

  'cta-banner': {
    name: 'Pre-Footer CTA Banner',
    description: 'Conversion-focused banner between content and footer. 6 visual variants selected per-build.',
    existsInTemplate: true,
    componentFile: 'CtaBanner.astro',
    when: 'Always — every build gets a CTA banner via BaseLayout',
    placement: 'Between ReviewsStrip and Footer (all pages via BaseLayout)',
    aggressiveness: 'medium',
    variants: ['full-bleed-accent', 'split-image', 'stats-bar', 'testimonial-cta', 'emergency-urgent', 'map-cta'],
    dataShape: {
      field: 'ctaBanner',
      type: '{ variant: string; headline?: string; subtitle?: string }',
      example: { variant: 'stats-bar', headline: 'Need a Plumber in Cape Town?', subtitle: 'Call us for fast, reliable service.' },
    },
  },

  'section-divider': {
    name: 'Section Divider Shape',
    description: 'SVG shape divider at bottom of hero and optionally between other sections. 6 shape options.',
    existsInTemplate: true,
    componentFile: 'SectionDivider.astro',
    when: 'Design direction or competitor analysis suggests shaped transitions',
    placement: 'Bottom of Hero section; optionally between 1-2 other section pairs',
    aggressiveness: 'low',
    variants: ['wave', 'angle', 'curve', 'zigzag', 'arrow', 'torn'],
  },
};

// ---------------------------------------------------------------------------
// CSS enhancement presets — beyond uniqueness-tweaker's axes
// ---------------------------------------------------------------------------
export const CSS_PRESETS = {
  'mixed-case-headings': {
    name: 'Mixed Case Heading Hierarchy',
    description: 'H1 stays uppercase for impact, H2/H3+ go sentence case for warmth and readability.',
    aggressiveness: 'medium',
    css: `/* Mixed case heading hierarchy */
h1 { text-transform: uppercase; font-weight: 900; letter-spacing: 0.05em; }
h2 { text-transform: none; font-weight: 800; letter-spacing: -0.01em; }
h3 { text-transform: none; font-weight: 700; letter-spacing: -0.01em; }
h4, h5, h6 { text-transform: none; font-weight: 700; }`,
    conflictsWith: ['headingCase'], // uniqueness-tweaker axis
  },

  'warm-surfaces': {
    name: 'Warm Surface Colors',
    description: 'Replace cool greys with warm off-whites. Adds subtle warm tint to shadows.',
    aggressiveness: 'low',
    css: `/* Warm surface colors */
:root {
  --color-background: #FAFAF8;
  --color-surface: #F7F6F4;
}
.shadow-sm { box-shadow: 0 1px 3px rgba(120,100,80,0.06), 0 1px 2px rgba(120,100,80,0.04); }
.shadow-md { box-shadow: 0 4px 12px rgba(120,100,80,0.08), 0 2px 4px rgba(120,100,80,0.04); }
.hover\\:shadow-md:hover { box-shadow: 0 6px 16px rgba(120,100,80,0.1), 0 3px 6px rgba(120,100,80,0.06); }
.hover\\:shadow-xl:hover { box-shadow: 0 10px 24px rgba(120,100,80,0.12), 0 4px 8px rgba(120,100,80,0.06); }`,
  },

  'graduated-weights': {
    name: 'Graduated Heading Weights',
    description: 'Each heading level gets progressively lighter weight for visual hierarchy.',
    aggressiveness: 'low',
    css: `/* Graduated heading weights */
h1 { font-weight: 900; }
h2 { font-weight: 800; }
h3 { font-weight: 700; }
h4, h5, h6 { font-weight: 600; }`,
  },

  'hero-gradient-overlay': {
    name: 'Gradient Hero Overlay',
    description: 'Replace flat bg-primary/75 with angled gradient for depth and visual interest.',
    aggressiveness: 'low',
    // Applied via Tailwind class swap, not CSS injection
    oldClass: 'bg-primary/75',
    newClass: 'bg-gradient-to-br from-primary/82 via-primary/70 to-primary/55',
  },

  'section-alternating-bg': {
    name: 'Alternating Section Backgrounds',
    description: 'Alternate between surface and background colors for visual rhythm.',
    aggressiveness: 'low',
    css: `/* Alternating section backgrounds */
section:nth-child(odd) { background: var(--color-background); }
section:nth-child(even) { background: var(--color-surface); }`,
  },

  'card-hover-lift': {
    name: 'Card Hover Lift Effect',
    description: 'Cards lift and gain shadow on hover for tactile feedback.',
    aggressiveness: 'low',
    css: `/* Card hover lift */
.group:hover {
  transform: translateY(-6px);
  box-shadow: 0 16px 32px rgba(0,0,0,0.1), 0 6px 12px rgba(0,0,0,0.06);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}`,
  },

  'accent-underline-headings': {
    name: 'Accent Underline on Section Headings',
    description: 'Short accent-colored bar under section headings for visual punctuation.',
    aggressiveness: 'low',
    css: `/* Accent underline on section headings */
section h2::after {
  content: '';
  display: block;
  width: 60px;
  height: 4px;
  background: var(--color-accent);
  margin-top: 0.75rem;
  border-radius: 2px;
}
.text-center h2::after {
  margin-inline: auto;
}`,
  },

  'scroll-reveal': {
    name: 'Scroll Reveal Animations',
    description: 'Sections fade in and slide up as they enter viewport. Uses IntersectionObserver.',
    aggressiveness: 'medium',
    css: `/* Scroll reveal */
.reveal {
  opacity: 0;
  transform: translateY(30px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}
.reveal.visible {
  opacity: 1;
  transform: translateY(0);
}`,
    requiresJS: true,
    jsSnippet: `<script>
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } });
}, { threshold: 0.1 });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
</script>`,
  },
};

// ---------------------------------------------------------------------------
// Niche-based recommendations
// ---------------------------------------------------------------------------
export const NICHE_RECOMMENDATIONS = {
  // Emergency services — urgency, trust, speed
  plumber:      { hero: 'split-with-form', components: ['google-badge', 'years-badge', 'value-strip', 'emergency-bar', 'price-tags', 'cta-banner', 'section-divider'], css: ['mixed-case-headings', 'warm-surfaces', 'hero-gradient-overlay', 'graduated-weights'], ctaBanner: 'emergency-urgent', sectionDivider: 'wave' },
  plumbing:     { hero: 'split-with-form', components: ['google-badge', 'years-badge', 'value-strip', 'emergency-bar', 'price-tags', 'cta-banner', 'section-divider'], css: ['mixed-case-headings', 'warm-surfaces', 'hero-gradient-overlay', 'graduated-weights'], ctaBanner: 'emergency-urgent', sectionDivider: 'wave' },
  electrician:  { hero: 'split-with-form', components: ['google-badge', 'years-badge', 'emergency-bar', 'price-tags', 'cta-banner', 'section-divider'], css: ['mixed-case-headings', 'hero-gradient-overlay', 'graduated-weights'], ctaBanner: 'emergency-urgent', sectionDivider: 'angle' },
  electrical:   { hero: 'split-with-form', components: ['google-badge', 'years-badge', 'emergency-bar', 'price-tags', 'cta-banner', 'section-divider'], css: ['mixed-case-headings', 'hero-gradient-overlay', 'graduated-weights'], ctaBanner: 'emergency-urgent', sectionDivider: 'angle' },
  locksmith:    { hero: 'full-bleed-gradient', components: ['google-badge', 'years-badge', 'emergency-bar', 'cta-banner', 'section-divider'], css: ['mixed-case-headings', 'warm-surfaces', 'graduated-weights', 'card-hover-lift'], ctaBanner: 'emergency-urgent', sectionDivider: 'arrow' },
  'pest control': { hero: 'split-with-badges', components: ['google-badge', 'years-badge', 'value-strip', 'cta-banner', 'section-divider'], css: ['mixed-case-headings', 'warm-surfaces', 'accent-underline-headings'], ctaBanner: 'stats-bar', sectionDivider: 'curve' },
  'garage door': { hero: 'split-with-form', components: ['google-badge', 'years-badge', 'emergency-bar', 'price-tags', 'cta-banner', 'section-divider'], css: ['mixed-case-headings', 'hero-gradient-overlay'], ctaBanner: 'emergency-urgent', sectionDivider: 'zigzag' },
  security:     { hero: 'full-bleed-gradient', components: ['google-badge', 'years-badge', 'emergency-bar', 'cta-banner', 'section-divider'], css: ['mixed-case-headings', 'graduated-weights'], ctaBanner: 'stats-bar', sectionDivider: 'angle' },
  towing:       { hero: 'split-with-form', components: ['google-badge', 'emergency-bar', 'cta-banner', 'section-divider'], css: ['mixed-case-headings', 'hero-gradient-overlay'], ctaBanner: 'emergency-urgent', sectionDivider: 'arrow' },

  // Planned/project services — trust, quality, portfolio
  painting:     { hero: 'split-with-badges', components: ['google-badge', 'years-badge', 'value-strip', 'cta-banner', 'section-divider'], css: ['warm-surfaces', 'accent-underline-headings', 'scroll-reveal'], ctaBanner: 'split-image', sectionDivider: 'curve' },
  fencing:      { hero: 'split-with-badges', components: ['google-badge', 'years-badge', 'price-tags', 'cta-banner', 'section-divider'], css: ['warm-surfaces', 'mixed-case-headings', 'card-hover-lift'], ctaBanner: 'stats-bar', sectionDivider: 'zigzag' },
  roofing:      { hero: 'split-with-form', components: ['google-badge', 'years-badge', 'value-strip', 'price-tags', 'cta-banner', 'section-divider'], css: ['mixed-case-headings', 'hero-gradient-overlay', 'graduated-weights'], ctaBanner: 'stats-bar', sectionDivider: 'zigzag' },
  landscaping:  { hero: 'split-with-badges', components: ['google-badge', 'years-badge', 'cta-banner', 'section-divider'], css: ['warm-surfaces', 'scroll-reveal', 'accent-underline-headings'], ctaBanner: 'split-image', sectionDivider: 'wave' },
  cleaning:     { hero: 'split-with-form', components: ['google-badge', 'value-strip', 'price-tags', 'cta-banner', 'section-divider'], css: ['warm-surfaces', 'mixed-case-headings'], ctaBanner: 'testimonial-cta', sectionDivider: 'curve' },
  renovation:   { hero: 'split-with-badges', components: ['google-badge', 'years-badge', 'value-strip', 'cta-banner', 'section-divider'], css: ['warm-surfaces', 'graduated-weights', 'scroll-reveal'], ctaBanner: 'split-image', sectionDivider: 'angle' },
  building:     { hero: 'split-with-badges', components: ['google-badge', 'years-badge', 'price-tags', 'cta-banner', 'section-divider'], css: ['mixed-case-headings', 'graduated-weights', 'card-hover-lift'], ctaBanner: 'stats-bar', sectionDivider: 'angle' },
  welding:      { hero: 'full-bleed-gradient', components: ['google-badge', 'years-badge', 'price-tags', 'cta-banner', 'section-divider'], css: ['mixed-case-headings', 'graduated-weights'], ctaBanner: 'full-bleed-accent', sectionDivider: 'torn' },
  'aircon':     { hero: 'split-with-form', components: ['google-badge', 'years-badge', 'emergency-bar', 'value-strip', 'cta-banner', 'section-divider'], css: ['mixed-case-headings', 'hero-gradient-overlay'], ctaBanner: 'emergency-urgent', sectionDivider: 'curve' },
  'glass':      { hero: 'split-with-form', components: ['google-badge', 'years-badge', 'emergency-bar', 'cta-banner', 'section-divider'], css: ['mixed-case-headings', 'hero-gradient-overlay'], ctaBanner: 'emergency-urgent', sectionDivider: 'angle' },
};

// ---------------------------------------------------------------------------
// Feature-based overrides
// ---------------------------------------------------------------------------
export const FEATURE_ENHANCEMENTS = {
  'Emergency After Hour Service': {
    forceComponents: ['emergency-bar'],
    forceCss: [],
    heroOverride: null, // Don't override hero, just ensure emergency bar exists
  },
  'Low Cost Affordable': {
    forceComponents: ['value-strip', 'price-tags'],
    forceCss: [],
    heroOverride: null,
  },
  'Owner Managed': {
    forceComponents: [],
    forceCss: [],
    heroOverride: null,
    notes: 'Agent should personalize CTA copy to include owner name. Enlarge headshot on about page.',
  },
  'Qualified and Licensed': {
    forceComponents: [],
    forceCss: [],
    heroOverride: null,
    notes: 'Agent should ensure certification badges are prominent in trust section.',
  },
  'Over 5 Years Experience': {
    forceComponents: ['years-badge'],
    forceCss: [],
    heroOverride: null,
  },
  'Free Quotes': {
    forceComponents: ['value-strip'],
    forceCss: [],
    heroOverride: null,
  },
  'Fast Response': {
    forceComponents: ['emergency-bar'],
    forceCss: [],
    heroOverride: null,
    notes: 'Agent should add response time badge or mention speed in hero subtitle.',
  },
  'Warranty and Guarantees': {
    forceComponents: [],
    forceCss: [],
    heroOverride: null,
    notes: 'Agent should create or emphasize guarantee badge/shield in trust section.',
  },
  'Top Quality': {
    forceComponents: [],
    forceCss: ['scroll-reveal'],
    heroOverride: null,
    notes: 'Agent should emphasize gallery/portfolio section, add before/after if available.',
  },
};

// ---------------------------------------------------------------------------
// Helper: Check if niche is emergency-type
// ---------------------------------------------------------------------------
export function isEmergencyNiche(niche) {
  const lower = niche.toLowerCase();
  return EMERGENCY_NICHES.some(e => lower.includes(e));
}

// ---------------------------------------------------------------------------
// Helper: Get recommended enhancements for a niche + features combo
// ---------------------------------------------------------------------------
export function getRecommendations(niche, features = []) {
  const lower = niche.toLowerCase();

  // Find best niche match
  let nicheRec = NICHE_RECOMMENDATIONS[lower];
  if (!nicheRec) {
    // Try partial match
    for (const [key, rec] of Object.entries(NICHE_RECOMMENDATIONS)) {
      if (lower.includes(key) || key.includes(lower)) {
        nicheRec = rec;
        break;
      }
    }
  }

  // Default if no match found
  if (!nicheRec) {
    nicheRec = {
      hero: 'full-bleed-gradient',
      components: ['google-badge', 'years-badge', 'cta-banner', 'section-divider'],
      css: ['warm-surfaces', 'mixed-case-headings', 'graduated-weights'],
      ctaBanner: 'full-bleed-accent',
      sectionDivider: 'curve',
    };
  }

  // Merge feature-based overrides
  const components = new Set(nicheRec.components);
  const cssPresets = new Set(nicheRec.css);
  const notes = [];

  for (const feature of features) {
    const featureEnhancement = FEATURE_ENHANCEMENTS[feature];
    if (!featureEnhancement) continue;

    featureEnhancement.forceComponents?.forEach(c => components.add(c));
    featureEnhancement.forceCss?.forEach(c => cssPresets.add(c));
    if (featureEnhancement.heroOverride) {
      nicheRec.hero = featureEnhancement.heroOverride;
    }
    if (featureEnhancement.notes) {
      notes.push(`[${feature}] ${featureEnhancement.notes}`);
    }
  }

  return {
    hero: nicheRec.hero,
    components: [...components],
    css: [...cssPresets],
    ctaBanner: nicheRec.ctaBanner || 'full-bleed-accent',
    sectionDivider: nicheRec.sectionDivider || 'curve',
    notes,
  };
}
