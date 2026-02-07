#!/usr/bin/env node
// ============================================================================
// populate-locations.mjs
// ============================================================================
// Creates location JSON files from Airtable client data.
//
// Usage:
//   node scripts/populate-locations.mjs --project /path --data client-mapped.json
//
// Input: client-mapped.json (output from populate-config.mjs)
// Output: src/content/locations/*.json (max 3 cities)
//
// RULES:
// - Area pages are OPTIONAL. Only create them for locations that are
//   100+ km apart or in different municipalities/provinces.
// - If all service areas are within the same metro, create 0 area pages.
// - The homepage handles the primary city. Area pages are for distant secondary locations only.
// - Max 3 area pages total.
// ============================================================================

import { readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { buildLog } from './lib/build-logger.mjs';

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

function main() {
  const args = parseArgs();
  const projectDir = args.project || process.cwd();
  const dataFile = args.data || join(projectDir, 'client-mapped.json');

  if (!existsSync(dataFile)) {
    console.error(`Error: Data file not found: ${dataFile}`);
    console.error('Run populate-config.mjs first to generate client-mapped.json');
    process.exit(1);
  }

  const data = JSON.parse(readFileSync(dataFile, 'utf-8'));
  const locationsDir = join(projectDir, 'src/content/locations');

  // Clear existing location files
  if (existsSync(locationsDir)) {
    const existing = readdirSync(locationsDir).filter(f => f.endsWith('.json'));
    for (const f of existing) {
      unlinkSync(join(locationsDir, f));
    }
    console.log(`Cleared ${existing.length} existing location files`);
  }

  // Parse service areas into location groups (max 3)
  const serviceAreas = data.serviceAreas || '';
  const phone = data.phone || '(000) 000-0000';
  const name = data.name || 'Business';
  const niche = data.niche || 'Service';

  // Split areas by pipe, semicolon, or comma — but preserve parenthesized groups.
  // Example: "Helderberg (Somerset West, Strand, Stellenbosch)" stays as one area.
  // Strategy: temporarily replace commas inside parentheses, then split, then restore.
  let areas;
  if (serviceAreas.includes('|')) {
    // Pipe-delimited: preferred format, split on pipe only
    areas = serviceAreas.split('|').map(a => a.trim()).filter(Boolean);
  } else if (serviceAreas.includes(';')) {
    // Semicolon-delimited: split on semicolon only
    areas = serviceAreas.split(';').map(a => a.trim()).filter(Boolean);
  } else {
    // Comma-delimited: protect commas inside parentheses before splitting
    const protected_ = serviceAreas.replace(/\(([^)]*)\)/g, (match) =>
      match.replace(/,/g, '\x00')
    );
    areas = protected_.split(',')
      .map(a => a.replace(/\x00/g, ',').trim())
      .filter(Boolean);
  }

  const log = buildLog(projectDir);

  if (areas.length === 0) {
    // Fallback: use primary city
    areas = [data.city || 'Johannesburg'];
    log.fallback('populate-locations', `No service areas in data — falling back to primary city: ${areas[0]}`);
  }

  // Group into max 3 metro areas
  // Strategy: first 3 become city pages, rest become suburbs of the nearest city
  const MAX_CITIES = 3;
  const cities = areas.slice(0, MAX_CITIES);
  const remainingAreas = areas.slice(MAX_CITIES);

  // Distribute remaining areas as suburbs of existing cities (round-robin)
  const citySuburbs = cities.map(() => []);
  remainingAreas.forEach((area, i) => {
    citySuburbs[i % cities.length].push(area);
  });

  // Create location files
  const locationFiles = [];
  cities.forEach((city, i) => {
    const slug = `${slugify(niche)}-${slugify(city)}`;
    const suburbs = citySuburbs[i];
    const suburbsDisplay = suburbs.length > 0 ? suburbs.join(' | ') : city;

    const location = {
      city,
      slug,
      cityGroup: city,
      phone,
      suburbs: suburbsDisplay,
      metaTitle: `#1 ${niche} ${city} — ${name}`,
      metaDescription: `Professional ${niche.toLowerCase()} services in ${city}${suburbs.length > 0 ? `, ${suburbs.slice(0, 3).join(', ')}` : ''} and surrounding areas. Call ${phone} for a free quote.`,
    };

    const filePath = join(locationsDir, `${slugify(city)}.json`);
    writeFileSync(filePath, JSON.stringify(location, null, 2), 'utf-8');
    locationFiles.push({ city, slug, file: filePath, suburbs: suburbs.length });
    console.log(`  ✓ ${city} (${suburbs.length} suburbs) → ${slugify(city)}.json`);
  });

  log.info('populate-locations', `Created ${locationFiles.length} location files (max ${MAX_CITIES})`);
  console.log(`\n✓ Created ${locationFiles.length} location files (max ${MAX_CITIES})`);
  if (remainingAreas.length > 0) {
    log.info('populate-locations', `${remainingAreas.length} extra areas distributed as suburbs across ${cities.length} cities`);
    console.log(`  ${remainingAreas.length} additional areas distributed as suburbs`);
  }
  if (areas.length > MAX_CITIES) {
    log.skip('populate-locations', `Skipped ${areas.length - MAX_CITIES} areas as standalone city pages (max ${MAX_CITIES}) — added as suburbs instead`);
  }
}

main();
