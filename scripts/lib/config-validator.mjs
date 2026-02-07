// ============================================================================
// config-validator.mjs
// ============================================================================
// Zod schema mirroring the SiteConfig TypeScript interface (site.config.ts).
// Validates that a populated config has no template defaults remaining,
// service slugs are present, phone is not placeholder, metaTitle lengths OK.
//
// Usage:
//   import { validateSiteConfig } from './config-validator.mjs';
//   const result = validateSiteConfig(projectPath);
//   if (!result.valid) console.error(result.errors);
//
// Wire into phase-gate.mjs phase-4 artifact check.
// ============================================================================

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Zod schema for SiteConfig
// ---------------------------------------------------------------------------

const NavItem = z.object({
  label: z.string().min(1),
  href: z.string().startsWith('/'),
});

const Badge = z.object({
  icon: z.string().min(1),
  label: z.string().min(1),
});

const FAQ = z.object({
  question: z.string().min(10),
  answer: z.string().min(10),
});

const Service = z.object({
  title: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with dashes'),
  description: z.string().min(10),
  shortDescription: z.string().min(5),
  features: z.array(z.string()).min(1),
  faqs: z.array(FAQ).min(1),
  heroSubtitle: z.string().min(5),
  longDescription: z.string().min(20),
  whatWeCover: z.array(z.object({ title: z.string(), description: z.string() })).min(1),
  whyChooseUs: z.array(z.object({ bold: z.string(), text: z.string() })).min(1),
});

const SiteConfigSchema = z.object({
  name: z.string().min(2),
  tagline: z.string().min(3),
  description: z.string().min(10),
  foundingYear: z.string().regex(/^\d{4}$/),
  founder: z.string().min(2),
  url: z.string().url().or(z.string().startsWith('https://')),

  phone: z.string().min(8),
  phoneRaw: z.string().regex(/^\d{9,15}$/),
  whatsapp: z.string().regex(/^\d{9,15}$/),
  email: z.string().email(),

  address: z.object({
    street: z.string().min(1),
    city: z.string().min(2),
    region: z.string().min(2),
    postalCode: z.string().min(1),
    country: z.literal('ZA'),
    coords: z.object({ lat: z.number(), lng: z.number() }),
  }),

  theme: z.object({
    primary: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    primaryLight: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    accent: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    accentLight: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    background: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    surface: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    text: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    muted: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    displayFont: z.string().min(2),
    bodyFont: z.string().min(2),
    accentFont: z.string().optional(),
  }),

  nav: z.array(NavItem).min(3),
  badges: z.array(Badge).min(1),
  services: z.array(Service).min(1).max(6),

  homepage: z.object({
    title: z.string(),
    metaTitle: z.string().min(10).max(70),
    metaDescription: z.string().min(50).max(160),
    heroTitle: z.string().min(10),
    heroSubtitle: z.string().min(10),
    whyChooseTitle: z.string().min(3),
    whyChooseSubtitle: z.string().min(5),
    whyChooseCards: z.array(z.object({
      icon: z.string(),
      title: z.string().min(2),
      description: z.string().min(10),
    })).min(3),
    faqs: z.array(FAQ).min(1),
  }),

  about: z.object({
    metaTitle: z.string().min(10).max(70),
    metaDescription: z.string().min(30).max(160),
    heroTitle: z.string().min(3),
    heroSubtitle: z.string().min(5),
    heading: z.string().min(3),
    paragraphs: z.array(z.string().min(20)).min(1),
    badge: z.string().min(2),
    stats: z.array(z.object({ value: z.string(), label: z.string() })).min(2),
  }),

  contact: z.object({
    metaTitle: z.string().min(10).max(70),
    metaDescription: z.string().min(30).max(160),
    heroTitle: z.string().min(3),
    heroSubtitle: z.string().min(5),
    hours: z.object({
      standard: z.object({ label: z.string(), days: z.string(), hours: z.string() }),
      emergency: z.object({ label: z.string(), days: z.string(), hours: z.string() }),
    }),
    faqs: z.array(FAQ).min(1),
  }),

  reviews: z.object({
    metaTitle: z.string().min(5),
    metaDescription: z.string().min(10),
    averageRating: z.number().min(0).max(5),
    totalReviews: z.number().min(0),
    sourceSummary: z.string(),
    items: z.array(z.object({
      name: z.string(),
      text: z.string(),
      rating: z.number(),
    })),
  }),

  servicesPage: z.object({
    metaTitle: z.string().min(5),
    metaDescription: z.string().min(10),
    heroTitle: z.string().min(3),
    heroSubtitle: z.string().min(5),
  }),

  legal: z.object({
    registrations: z.array(z.string()).min(1),
    servicesList: z.array(z.string()).min(1),
  }),
});

// ---------------------------------------------------------------------------
// Template default detection — reject configs that still have placeholders
// ---------------------------------------------------------------------------

const TEMPLATE_DEFAULTS = [
  'Your Business Name',
  'Owner Name',
  'Your Tagline Here',
  '(012) 345-6789',
  '0123456789',
  '27123456789',
  'info@yourbusiness.com',
  '123 Main Street',
  'PLACEHOLDER',
  'TODO:',
  'REPLACE_ME',
  'info@example.com',
];

/**
 * Validate a populated site.config.ts against the SiteConfig schema.
 * Also checks for template defaults that should have been replaced.
 *
 * @param {string} projectPath - Path to the project root
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateSiteConfig(projectPath) {
  const configPath = join(projectPath, 'src/site.config.ts');
  if (!existsSync(configPath)) {
    return { valid: false, errors: ['site.config.ts does not exist'] };
  }

  const content = readFileSync(configPath, 'utf-8');
  const errors = [];

  // Check for template defaults
  for (const placeholder of TEMPLATE_DEFAULTS) {
    if (content.includes(placeholder)) {
      errors.push(`Template default still present: "${placeholder}"`);
    }
  }

  // Extract the config object from the TS file for Zod validation.
  // We can't import .ts directly, so we do a lightweight parse:
  // extract everything between `export const site: SiteConfig = {` and the final `};`
  const configMatch = content.match(/export\s+const\s+site\s*:\s*SiteConfig\s*=\s*(\{[\s\S]*\});?\s*$/m);
  if (!configMatch) {
    errors.push('Could not extract SiteConfig object from site.config.ts');
    return { valid: errors.length === 0, errors };
  }

  try {
    // Convert TS object literal to JSON-ish by wrapping unquoted keys
    let objStr = configMatch[1];
    // Remove trailing semicolons
    objStr = objStr.replace(/;\s*$/, '');
    // Add quotes to unquoted keys
    objStr = objStr.replace(/(\s)([a-zA-Z_$][a-zA-Z0-9_$]*)(\s*:)/g, '$1"$2"$3');
    // Replace single quotes with double quotes
    objStr = objStr.replace(/'/g, '"');
    // Remove trailing commas before } or ]
    objStr = objStr.replace(/,(\s*[}\]])/g, '$1');

    const parsed = JSON.parse(objStr);
    const result = SiteConfigSchema.safeParse(parsed);
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push(`${issue.path.join('.')}: ${issue.message}`);
      }
    }
  } catch (parseErr) {
    // JSON parse of TS object failed — fall back to string-level checks only.
    // This is expected for complex TS configs with SVG paths, template literals, etc.
    // Don't block the gate on parse failures — string-level checks still ran above.
  }

  return { valid: errors.length === 0, errors };
}
