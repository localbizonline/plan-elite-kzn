#!/usr/bin/env node
// ============================================================================
// populate-config.mjs
// ============================================================================
// Takes Airtable client data (JSON) and populates site.config.ts.
//
// Usage:
//   node scripts/populate-config.mjs --project /path/to/project --data client-config.json
//   node scripts/populate-config.mjs --project /path/to/project --data client-config.json --design design-tokens.json
//
// Input: client-config.json (output from airtable-client-fetch skill)
//        design-tokens.json (optional, output from design-direction skill)
//          Format: { "fonts": { "display": "...", "body": "..." }, "colors": { "primary": "...", ... } }
// Output: Updated src/site.config.ts with client data + design tokens
// ============================================================================

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { buildLog } from './lib/build-logger.mjs';
import { validateClientConfig } from './schemas/client-config.schema.mjs';
import { replaceKeyValue, replaceNumericValue, replaceSection } from './lib/config-writer.mjs';

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace(/^--/, '');
    const value = args[i + 1];
    if (key && value) parsed[key] = value;
  }
  return parsed;
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function formatPhone(phone) {
  if (!phone) return '(000) 000-0000';
  // Strip to digits
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

function phoneToRaw(phone) {
  return phone.replace(/\D/g, '');
}

function phoneToWhatsApp(phone) {
  const raw = phoneToRaw(phone);
  // Convert 0xx to 27xx for South African numbers
  if (raw.startsWith('0') && raw.length === 10) {
    return '27' + raw.slice(1);
  }
  return raw;
}

/**
 * Maps Airtable client data to the site.config.ts structure.
 * This handles the field mapping from Airtable's format to our template format.
 */
function normalizeUrl(url) {
  if (!url) return '';
  let u = url.trim();
  if (u && !u.startsWith('http://') && !u.startsWith('https://')) {
    u = 'https://' + u;
  }
  return u;
}

function mapClientData(data) {
  const name = (data.companyName || data['Company name'] || 'Business Name').trim();
  const phone = data.phone || data['Phone number sent to leads'] || '';
  const whatsapp = data.whatsapp || data['WhatsApp number'] || phone;
  const email = (data.email || data['Email'] || '').trim();
  const owner = (data.ownerFirstName || data['Business owner name'] || 'Owner').trim();
  const ownerLast = (data.ownerLastName || data['Business owner surname'] || '').trim();
  const founder = ownerLast ? `${owner} ${ownerLast}` : owner;
  const niche = (data.niche || data['Niche your business covers'] || 'Service').trim();
  const yearStarted = data.yearStarted || data['Year Started'] || '2020';
  const website = normalizeUrl(data.website || data['Website'] || '');

  // Address fields
  const address = data.address || {};
  const city = data.primaryCity || data['City Based In'] || address.city || 'Johannesburg';
  const region = address.region || 'Gauteng';

  // Services (from Airtable, comes as array of strings or comma-separated)
  let services = data.services || data['Services'] || [];
  if (typeof services === 'string') {
    services = services.split(',').map(s => s.trim()).filter(Boolean);
  }

  // Features / differentiators
  let features = data.differentiators || data['Choose features that match your business'] || [];
  if (typeof features === 'string') {
    features = features.split(',').map(s => s.trim()).filter(Boolean);
  }

  // About text
  const aboutText = data.aboutText
    || data['About Prompt OUTPUT']
    || data['Partner About']
    || '';

  // Service areas — use pipe delimiter to avoid splitting issues with
  // parenthesized groups like "Helderberg (Somerset West, Strand)"
  let serviceAreas = data.serviceAreas || data['What areas does your company service?'] || '';
  if (Array.isArray(serviceAreas)) serviceAreas = serviceAreas.join(' | ');

  // Google Maps
  const mapsUrl = data['Google Maps URL'] || data.mapsEmbed || '';

  return {
    name,
    phone: formatPhone(phone),
    phoneRaw: phoneToRaw(phone),
    whatsapp: phoneToWhatsApp(whatsapp || phone),
    email,
    founder,
    yearStarted,
    niche,
    city,
    region,
    services,
    features,
    aboutText,
    serviceAreas,
    mapsUrl,
    website,
    address: {
      street: address.street || '',
      city,
      region,
      postalCode: address.postalCode || '',
      country: 'ZA',
      coords: address.coords || { lat: -26.2041, lng: 28.0473 },
      mapsEmbed: mapsUrl,
    },
  };
}

/**
 * Apply identity and contact data to site.config.ts using idempotent regex
 * key-value replacement. Works whether the config has template defaults or
 * already-populated values — running twice with the same data produces
 * identical output.
 *
 * @param {string} configContent - Current file content
 * @param {object} mapped - Mapped client data
 * @returns {{ content: string, count: number }}
 */
function applyIdentityAndContact(configContent, mapped) {
  let content = configContent;
  let count = 0;

  const keyValuePairs = [
    // Identity
    ['name', mapped.name],
    ['tagline', `Professional ${mapped.niche} Services`],
    ['description', `Professional ${mapped.niche.toLowerCase()} services in ${mapped.city} and surrounding areas. Quality workmanship, fair pricing.`],
    ['foundingYear', mapped.yearStarted],
    ['founder', mapped.founder],
    ['url', mapped.website || 'https://example.com'],

    // Contact
    ['phone', mapped.phone],
    ['phoneRaw', mapped.phoneRaw],
    ['whatsapp', mapped.whatsapp],
    ['email', mapped.email],

    // Address (nested keys still match because regex is greedy on key name)
    ['street', mapped.address.street],
    ['city', mapped.city],
    ['region', mapped.region],
    ['postalCode', mapped.address.postalCode],
  ];

  for (const [key, value] of keyValuePairs) {
    if (!value) continue;
    const updated = replaceKeyValue(content, key, value);
    if (updated !== content) {
      content = updated;
      count++;
    }
  }

  // Numeric coordinates
  if (mapped.address.coords) {
    const latUpdated = replaceNumericValue(content, 'lat', mapped.address.coords.lat);
    if (latUpdated !== content) { content = latUpdated; count++; }
    const lngUpdated = replaceNumericValue(content, 'lng', mapped.address.coords.lng);
    if (lngUpdated !== content) { content = lngUpdated; count++; }
  }

  // mapsEmbed is a URL string
  if (mapped.address.mapsEmbed) {
    const updated = replaceKeyValue(content, 'mapsEmbed', mapped.address.mapsEmbed);
    if (updated !== content) { content = updated; count++; }
  }

  return { content, count };
}

/**
 * Applies design tokens (fonts + colors) from design-direction output.
 * Expects a JSON file with structure: { fonts: { display, body }, colors: { primary, accent, ... } }
 * or reads from BRAND.md-adjacent brand-tokens.json.
 */
function applyDesignTokens(configContent, designData) {
  let content = configContent;
  let count = 0;

  // Font replacements
  const fonts = designData.fonts || {};
  if (fonts.display) {
    const replaced = content.replace(/displayFont:\s*["'][^"']+["']/, `displayFont: "${fonts.display}"`);
    if (replaced !== content) { content = replaced; count++; }
  }
  if (fonts.body) {
    const replaced = content.replace(/bodyFont:\s*["'][^"']+["']/, `bodyFont: "${fonts.body}"`);
    if (replaced !== content) { content = replaced; count++; }
  }
  if (fonts.accent) {
    // Add accentFont if not already present, or update if it exists
    if (content.includes('accentFont:')) {
      const replaced = content.replace(/accentFont:\s*["'][^"']+["']/, `accentFont: "${fonts.accent}"`);
      if (replaced !== content) { content = replaced; count++; }
    } else {
      // Insert after bodyFont line
      const replaced = content.replace(
        /(bodyFont:\s*["'][^"']+["'],?)/,
        `$1\n    accentFont: "${fonts.accent}",`
      );
      if (replaced !== content) { content = replaced; count++; }
    }
  }

  // Color replacements
  const colors = designData.colors || {};
  const colorMap = {
    primary: 'primary',
    primaryLight: 'primaryLight',
    accent: 'accent',
    accentLight: 'accentLight',
    background: 'background',
    surface: 'surface',
    text: 'text',
    muted: 'muted',
  };
  for (const [jsonKey, configKey] of Object.entries(colorMap)) {
    if (colors[jsonKey]) {
      const regex = new RegExp(`${configKey}:\\s*["'][^"']+["']`);
      const replaced = content.replace(regex, `${configKey}: "${colors[jsonKey]}"`);
      if (replaced !== content) { content = replaced; count++; }
    }
  }

  return { content, count };
}

/**
 * Apply ctaBanner config from design tokens (if provided).
 * Writes the ctaBanner block into site.config.ts.
 * Phase 7.8 (design-enhancer) may override this later with niche-specific selections.
 */
function applyCtaBanner(configContent, designData) {
  let content = configContent;
  let count = 0;

  const cta = designData.ctaBanner;
  if (!cta || !cta.variant) return { content, count };

  const variant = cta.variant;
  const headline = cta.headline || '';
  const subtitle = cta.subtitle || '';

  // Build the ctaBanner block
  const block = headline
    ? `ctaBanner: {\n    variant: '${variant}',\n    headline: '${headline.replace(/'/g, "\\'")}',\n    subtitle: '${subtitle.replace(/'/g, "\\'")}',\n  },`
    : `ctaBanner: {\n    variant: '${variant}',\n  },`;

  if (content.includes('ctaBanner:')) {
    // Replace existing ctaBanner block
    const regex = /ctaBanner:\s*\{[^}]+\},?/;
    const replaced = content.replace(regex, block);
    if (replaced !== content) { content = replaced; count++; }
  } else {
    // Insert before the closing of the site export (before last }; or } as const)
    const replaced = content.replace(
      /(homepage:\s*\{)/,
      `${block}\n  $1`
    );
    if (replaced !== content) { content = replaced; count++; }
  }

  return { content, count };
}

// ============================================================================
// Feature-to-Badge Mapping
// ============================================================================
// Maps Airtable "Choose features that match your business" multiSelect values
// to badge objects with SVG icon paths and display labels.
// ============================================================================

const FEATURE_BADGE_MAP = {
  'Free Quotes': {
    icon: '<path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>',
    label: 'Free Quotes',
    heroBadge: 'Free Quotes',
  },
  'Qualified and Licensed': {
    icon: '<path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>',
    label: 'Qualified & Licensed',
    heroBadge: 'Licensed',
  },
  'Emergency After Hour Service': {
    icon: '<path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>',
    label: '24/7 Emergency Service',
    heroBadge: '24/7 Emergency',
  },
  'Low Cost Affordable': {
    icon: '<path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>',
    label: 'Affordable Pricing',
    heroBadge: 'Affordable',
  },
  'Owner Managed': {
    icon: '<path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>',
    label: 'Owner Managed',
    heroBadge: 'Owner Managed',
  },
  'Fast Response': {
    icon: '<path d="M13 10V3L4 14h7v7l9-11h-7z"/>',
    label: 'Fast Response',
    heroBadge: 'Fast Response',
  },
  'Warranty and Guarantees': {
    icon: '<path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>',
    label: 'Warranty & Guarantees',
    heroBadge: 'Guaranteed Work',
  },
  'Over 5 Years Experience': {
    icon: '<path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/>',
    label: '5+ Years Experience',
    heroBadge: 'Experienced',
  },
  'Top Quality': {
    icon: '<path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>',
    label: 'Top Quality',
    heroBadge: 'Top Quality',
  },
};

/**
 * Convert Airtable features array to badge objects and heroBadge strings.
 * Falls back to template defaults if no features provided.
 *
 * @param {string[]} features - Airtable feature strings
 * @returns {{ badges: Array<{icon: string, label: string}>, heroBadges: string[] }}
 */
function featuresToBadges(features) {
  if (!features || features.length === 0) {
    return { badges: null, heroBadges: null };
  }

  const badges = [];
  const heroBadges = [];

  for (const feature of features) {
    const mapped = FEATURE_BADGE_MAP[feature];
    if (mapped) {
      badges.push({ icon: mapped.icon, label: mapped.label });
      heroBadges.push(mapped.heroBadge);
    }
  }

  if (badges.length === 0) {
    return { badges: null, heroBadges: null };
  }

  return { badges, heroBadges };
}

/**
 * Apply features/badges from Airtable to site.config.ts.
 * Replaces the badges array and heroBadges array.
 *
 * @param {string} configContent - Current file content
 * @param {object} mapped - Mapped client data (with .features)
 * @returns {{ content: string, count: number }}
 */
function applyFeatures(configContent, mapped) {
  let content = configContent;
  let count = 0;

  const { badges, heroBadges } = featuresToBadges(mapped.features);

  if (badges) {
    // badges is a top-level array (2-space indent) — replaceSection handles this
    const updated = replaceSection(content, 'badges', badges);
    if (updated !== content) {
      content = updated;
      count++;
    }
  }

  if (heroBadges) {
    // heroBadges is nested inside homepage (4-space indent) — use direct regex
    const serialized = JSON.stringify(heroBadges);
    const regex = /heroBadges:\s*\[.*?\]/;
    if (regex.test(content)) {
      const updated = content.replace(regex, `heroBadges: ${serialized}`);
      if (updated !== content) {
        content = updated;
        count++;
      }
    }
  }

  return { content, count };
}

function main() {
  const args = parseArgs();
  const projectDir = args.project || process.cwd();
  const dataFile = args.data;

  if (!dataFile) {
    console.error('Error: --data is required (path to client config JSON)');
    console.error('Usage: node scripts/populate-config.mjs --project /path --data client-config.json');
    process.exit(1);
  }

  const dataPath = resolve(dataFile);
  if (!existsSync(dataPath)) {
    console.error(`Error: Data file not found: ${dataPath}`);
    process.exit(1);
  }

  const configFilePath = join(projectDir, 'src/site.config.ts');
  if (!existsSync(configFilePath)) {
    console.error(`Error: site.config.ts not found at: ${configFilePath}`);
    process.exit(1);
  }

  // Read inputs
  let clientData;
  try {
    clientData = JSON.parse(readFileSync(dataPath, 'utf-8'));
  } catch (err) {
    console.error(`Error: Failed to parse ${dataPath}: ${err.message}`);
    process.exit(1);
  }
  let configContent = readFileSync(configFilePath, 'utf-8');

  // Validate client data against schema
  const validation = validateClientConfig(clientData);
  const log = buildLog(projectDir);
  if (!validation.success) {
    console.log(`Warning: client-config.json has validation issues:`);
    for (const err of validation.errors) {
      console.log(`  - ${err}`);
      log.warning('populate-config', `Validation: ${err}`);
    }
  }

  // Map and replace using idempotent regex key-value replacement
  const mapped = mapClientData(clientData);
  const identity = applyIdentityAndContact(configContent, mapped);
  configContent = identity.content;
  const replacedCount = identity.count;

  // Apply features → badges + heroBadges from Airtable
  let featuresCount = 0;
  const featuresResult = applyFeatures(configContent, mapped);
  configContent = featuresResult.content;
  featuresCount = featuresResult.count;

  // Apply design tokens (fonts + colors) if provided
  const designFile = args.design;
  let designCount = 0;
  if (designFile) {
    const designPath = resolve(designFile);
    if (existsSync(designPath)) {
      const designData = JSON.parse(readFileSync(designPath, 'utf-8'));
      const result = applyDesignTokens(configContent, designData);
      configContent = result.content;
      designCount = result.count;
      log.info('populate-config', `Design tokens applied: ${designCount} values (fonts + colors)`);

      // Apply ctaBanner if present in design tokens
      const ctaResult = applyCtaBanner(configContent, designData);
      configContent = ctaResult.content;
      if (ctaResult.count > 0) {
        designCount += ctaResult.count;
        log.info('populate-config', `CTA banner variant set: ${designData.ctaBanner?.variant || 'none'}`);
      }
    } else {
      log.missing('populate-config', `Design tokens file not found: ${designPath}`);
    }
  }

  // Write updated config
  writeFileSync(configFilePath, configContent, 'utf-8');

  // Log missing fields
  if (!mapped.phone || mapped.phone === '(000) 000-0000') log.missing('populate-config', 'No phone number in client data');
  if (!mapped.email) log.missing('populate-config', 'No email in client data');
  if (mapped.services.length === 0) log.missing('populate-config', 'No services listed in client data');
  if (!mapped.aboutText) log.missing('populate-config', 'No about text in client data — needs AI generation');
  if (!mapped.serviceAreas) log.missing('populate-config', 'No service areas in client data');
  if (!mapped.mapsUrl) log.missing('populate-config', 'No Google Maps URL in client data');
  if (mapped.features.length === 0) {
    log.missing('populate-config', 'No features/differentiators in client data — badges remain as template defaults');
  } else {
    log.info('populate-config', `Features mapped to badges: ${mapped.features.join(', ')}`);
  }
  log.info('populate-config', `Config populated: ${replacedCount} fields replaced (idempotent)`);

  console.log(`✓ site.config.ts updated with client data`);
  console.log(`  Name: ${mapped.name}`);
  console.log(`  Phone: ${mapped.phone}`);
  console.log(`  Email: ${mapped.email}`);
  console.log(`  City: ${mapped.city}`);
  console.log(`  Services: ${mapped.services.length} found`);
  console.log(`  Features: ${mapped.features.length} found${featuresCount > 0 ? ` (${featuresCount} sections updated)` : ' (no badges updated)'}`);
  if (designCount > 0) {
    console.log(`  Design tokens: ${designCount} values applied (fonts + colors)`);
    console.log(`  → Next: run download-fonts.mjs to fetch font files`);
  } else if (!designFile) {
    console.log(`\nNote: No --design flag provided. Fonts and colors remain as template defaults.`);
    console.log(`  To apply design tokens: --design design-tokens.json`);
  }
  console.log(`\nNote: Services, FAQs, reviews still need`);
  console.log(`manual editing or AI generation via skills.`);

  // Output mapped data for downstream scripts
  const mappedPath = join(projectDir, 'client-mapped.json');
  writeFileSync(mappedPath, JSON.stringify(mapped, null, 2), 'utf-8');
  console.log(`\n✓ Mapped data saved to: ${mappedPath}`);

  // Write provenance tracking — records source of each field for debugging and sync
  const provenance = {
    generatedAt: new Date().toISOString(),
    source: 'populate-config.mjs',
    fields: {},
  };
  const airtableFields = {
    name: 'companyName',
    phone: 'phone',
    email: 'email',
    founder: 'ownerFirstName + ownerLastName',
    foundingYear: 'yearStarted',
    city: 'primaryCity',
    region: 'address.region',
    street: 'address.street',
    postalCode: 'address.postalCode',
    whatsapp: 'whatsapp',
    mapsEmbed: 'Google Maps URL',
    tagline: 'derived:niche',
    description: 'derived:niche+city',
    badges: 'derived:differentiators',
    heroBadges: 'derived:differentiators',
  };
  for (const [field, airtableKey] of Object.entries(airtableFields)) {
    provenance.fields[field] = {
      source: 'airtable',
      field: airtableKey,
      updatedAt: new Date().toISOString(),
    };
  }
  if (designCount > 0) {
    for (const key of ['displayFont', 'bodyFont', 'accentFont', 'primary', 'accent', 'primaryLight', 'accentLight', 'background', 'surface', 'text', 'muted']) {
      provenance.fields[key] = {
        source: 'design-tokens',
        field: key,
        updatedAt: new Date().toISOString(),
      };
    }
  }
  const provenancePath = join(projectDir, 'src/config-provenance.json');
  writeFileSync(provenancePath, JSON.stringify(provenance, null, 2), 'utf-8');
  console.log(`✓ Provenance tracking saved to: src/config-provenance.json`);
}

main();
