#!/usr/bin/env node
// ============================================================================
// fetch-airtable.mjs
// ============================================================================
// Standalone Airtable REST API fetcher for the build runner.
// Replaces the MCP-based Airtable fetch with a direct REST call.
//
// Usage:
//   node scripts/fetch-airtable.mjs --company "SA Plumbing Solutions" --output ./client-config.json
//   node scripts/fetch-airtable.mjs --record-id recXXXXXX --output ./client-config.json
//
// Requires: AIRTABLE_TOKEN env var (Personal Access Token)
// ============================================================================

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE_ID = 'app7AZ1zHElQfR4EH';
const TABLE_ID = 'tblUrtOlK3majSIFi';
const VIEW_ID = 'viw0NUctZkJOsXfRs';
const API_BASE = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`;

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

function getToken() {
  const token = process.env.AIRTABLE_TOKEN;
  if (!token) {
    console.error('Error: AIRTABLE_TOKEN environment variable is not set.');
    console.error('Get a Personal Access Token from: https://airtable.com/create/tokens');
    process.exit(1);
  }
  return token;
}

// ---------------------------------------------------------------------------
// Airtable API calls
// ---------------------------------------------------------------------------

async function fetchByRecordId(recordId, token) {
  const url = `${API_BASE}/${recordId}`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Airtable API error ${res.status}: ${body}`);
  }

  return res.json();
}

async function fetchByCompanyName(companyName, token) {
  // Use SEARCH to do a case-insensitive substring match on Company name
  const formula = `SEARCH(LOWER("${companyName.replace(/"/g, '\\"')}"), LOWER({Company name}))`;
  const params = new URLSearchParams({
    filterByFormula: formula,
    view: VIEW_ID,
    maxRecords: '5',
  });

  const url = `${API_BASE}?${params}`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Airtable API error ${res.status}: ${body}`);
  }

  const data = await res.json();

  if (!data.records || data.records.length === 0) {
    throw new Error(`No Airtable records found matching "${companyName}"`);
  }

  // Return best match (first result, or exact match if found)
  const exact = data.records.find(r =>
    (r.fields['Company name'] || '').toLowerCase() === companyName.toLowerCase()
  );

  return exact || data.records[0];
}

// ---------------------------------------------------------------------------
// Linked record resolution
// ---------------------------------------------------------------------------

// Tables that linked record fields point to, and which field holds the display name
const LINKED_TABLES = {
  'tblwAjBgE4hJVuZ7d': { name: 'Area Selections', displayField: 'Name' },
  'tblLaLhGdM8YT10wc': { name: 'Category / Niche', displayField: 'Name' },
  'tblXRupREOoPrXKyV': { name: 'Service Selections', displayField: 'Service Name' },
};

// Which record fields map to which linked table
const FIELD_TABLE_MAP = {
  'City Based In':                        'tblwAjBgE4hJVuZ7d',
  'What areas does your company service?': 'tblwAjBgE4hJVuZ7d',
  'Niche your business covers':            'tblLaLhGdM8YT10wc',
  'Service':                               'tblXRupREOoPrXKyV',
};

/**
 * Batch-fetch records by IDs from a single Airtable table.
 * Uses OR(RECORD_ID()=...) formula. Chunks into groups of 50 to stay
 * within Airtable's formula length limits.
 */
async function fetchRecordsByIds(tableId, recordIds, token) {
  if (!recordIds.length) return {};
  const unique = [...new Set(recordIds)];
  const results = {};
  const displayField = LINKED_TABLES[tableId]?.displayField || 'Name';

  // Chunk into groups of 50
  for (let i = 0; i < unique.length; i += 50) {
    const chunk = unique.slice(i, i + 50);
    const parts = chunk.map(id => `RECORD_ID()="${id}"`);
    const formula = `OR(${parts.join(',')})`;
    const params = new URLSearchParams({
      filterByFormula: formula,
      'fields[]': displayField,
    });

    const url = `https://api.airtable.com/v0/${BASE_ID}/${tableId}?${params}`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!res.ok) {
      console.error(`Warning: Failed to resolve linked records from ${tableId}: HTTP ${res.status}`);
      continue;
    }

    const data = await res.json();
    for (const rec of (data.records || [])) {
      results[rec.id] = rec.fields[displayField] || rec.id;
    }
  }

  return results;
}

/**
 * Resolves all linked record IDs in a record's fields to human-readable names.
 * Returns a flat map: recordId → displayName
 */
async function resolveLinkedRecords(fields, token) {
  // Collect record IDs grouped by target table
  const byTable = {};

  for (const [fieldName, tableId] of Object.entries(FIELD_TABLE_MAP)) {
    const value = fields[fieldName];
    if (!value) continue;
    const ids = Array.isArray(value) ? value : [value];
    const recordIds = ids.filter(id => typeof id === 'string' && id.startsWith('rec'));
    if (recordIds.length === 0) continue;

    if (!byTable[tableId]) byTable[tableId] = [];
    byTable[tableId].push(...recordIds);
  }

  // Batch-fetch from each table in parallel
  const lookupMap = {};
  const fetches = Object.entries(byTable).map(async ([tableId, ids]) => {
    const resolved = await fetchRecordsByIds(tableId, ids, token);
    Object.assign(lookupMap, resolved);
  });

  await Promise.all(fetches);
  return lookupMap;
}

/**
 * Replace record IDs in an array with resolved display names.
 * Falls back to the original ID if not found in the lookup map.
 */
function resolveIds(value, lookupMap) {
  if (!value) return value;
  if (Array.isArray(value)) {
    return value.map(v => (typeof v === 'string' && lookupMap[v]) ? lookupMap[v] : v);
  }
  if (typeof value === 'string' && lookupMap[value]) {
    return lookupMap[value];
  }
  return value;
}

// ---------------------------------------------------------------------------
// Field mapping — Airtable fields → client-config.json
// ---------------------------------------------------------------------------

function extractAttachmentUrl(field) {
  if (!field) return null;
  if (typeof field === 'string') return field;
  if (Array.isArray(field) && field.length > 0) {
    return field[0].url || field[0];
  }
  if (field.url) return field.url;
  return null;
}

function extractAttachments(field) {
  if (!field) return [];
  if (Array.isArray(field)) {
    return field.map(item => {
      if (typeof item === 'string') return item;
      if (item.url) return item.url;
      return null;
    }).filter(Boolean);
  }
  return [];
}

function extractFirstValue(field) {
  if (!field) return '';
  if (Array.isArray(field)) return field[0] || '';
  return String(field);
}

function transformRecord(record, lookupMap = {}) {
  const f = record.fields;

  // Resolve linked record IDs to display names
  const resolvedCity = resolveIds(f['City Based In'], lookupMap);
  const resolvedNiche = resolveIds(f['Niche your business covers'], lookupMap);
  const resolvedServices = resolveIds(
    Array.isArray(f['Service']) ? f['Service'] : (f['Service'] ? [f['Service']] : []),
    lookupMap
  );
  const resolvedAreas = resolveIds(f['What areas does your company service?'], lookupMap);

  return {
    recordId: record.id,
    companyName: f['Company name'] || '',
    phone: f['Phone number sent to leads'] || '',
    whatsapp: f['WhatsApp Number'] || f['Phone number sent to leads'] || '',
    email: f['Business owners email'] || '',
    ownerFirstName: (f['Business owner name'] || '').trim(),
    ownerLastName: (f['Business owner surname'] || '').trim(),
    primaryCity: extractFirstValue(resolvedCity),
    niche: extractFirstValue(resolvedNiche),
    yearStarted: f['LLP - Year business started'] || f['Year Started'] || '',
    services: resolvedServices,
    serviceAreas: Array.isArray(resolvedAreas)
      ? resolvedAreas.join(', ')
      : (resolvedAreas || ''),
    differentiators: Array.isArray(f['Choose features that match your business'])
      ? f['Choose features that match your business']
      : (f['Choose features that match your business'] ? [f['Choose features that match your business']] : []),
    aboutText: f['About Prompt OUTPUT'] || f['Partner About'] || '',
    servicesText: f['Services Rewrite OUTPUT'] || f['Partner Services'] || '',
    website: f['Partner Website'] || '',
    // Attachments
    logo: f['Partner Logo'] || null,
    headshot: f['Partner Headshot'] || null,
    gallery: f['Gallery'] || null,
    // URLs — try new field names first, fall back to legacy names
    googleMapsUrl: f['Google Business Profile'] || f['Google Maps URL'] || '',
    helloPeterUrl: f['Hello Peter'] || f['Hello Peter URL'] || '',
    // Address
    address: f['Physical Address'] || '',
    // Social
    facebook: f['Facebook'] || '',
    instagram: f['Instagram'] || '',
    // Rating
    rating: f['Company Rating'] || null,
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateRecord(config) {
  const required = ['companyName', 'phone', 'primaryCity', 'niche'];
  const missing = required.filter(k => !config[k]);

  const recommended = ['logo', 'aboutText', 'services', 'serviceAreas', 'differentiators', 'email'];
  const warnings = recommended.filter(k => {
    const v = config[k];
    if (v === null || v === undefined || v === '') return true;
    if (Array.isArray(v) && v.length === 0) return true;
    return false;
  });

  return { valid: missing.length === 0, missing, warnings };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs();
  const token = getToken();

  if (!args.company && !args['record-id']) {
    console.error('Usage:');
    console.error('  node scripts/fetch-airtable.mjs --company "Company Name" --output ./client-config.json');
    console.error('  node scripts/fetch-airtable.mjs --record-id recXXXXXX --output ./client-config.json');
    process.exit(1);
  }

  const outputPath = resolve(args.output || './client-config.json');

  console.log('Fetching client data from Airtable...');

  let record;
  if (args['record-id']) {
    console.log(`  Looking up record: ${args['record-id']}`);
    record = await fetchByRecordId(args['record-id'], token);
  } else {
    console.log(`  Searching for: "${args.company}"`);
    record = await fetchByCompanyName(args.company, token);
  }

  console.log(`  Found: ${record.fields['Company name'] || 'Unknown'} (${record.id})`);

  // Resolve linked record IDs (City, Niche, Services, Areas) to display names
  console.log('  Resolving linked records...');
  const lookupMap = await resolveLinkedRecords(record.fields, token);
  const resolvedCount = Object.keys(lookupMap).length;
  if (resolvedCount > 0) {
    console.log(`  Resolved ${resolvedCount} linked record(s)`);
  }

  // Transform to our format
  const config = transformRecord(record, lookupMap);

  // Validate
  const validation = validateRecord(config);
  if (!validation.valid) {
    console.error(`\nMissing required fields: ${validation.missing.join(', ')}`);
    console.error('These fields are required for a build to proceed.');
    process.exit(1);
  }

  if (validation.warnings.length > 0) {
    console.log(`\nWarnings — these fields are empty (build will use fallbacks):`);
    for (const w of validation.warnings) {
      console.log(`  - ${w}`);
    }
  }

  // Write output
  writeFileSync(outputPath, JSON.stringify(config, null, 2), 'utf-8');

  console.log(`\n✓ Client config saved to: ${outputPath}`);
  console.log(`  Company: ${config.companyName}`);
  console.log(`  Niche: ${config.niche}`);
  console.log(`  City: ${config.primaryCity}`);
  console.log(`  Services: ${config.services.length} found`);
  console.log(`  Record ID: ${config.recordId}`);
}

main().catch(err => {
  console.error(`\nAirtable fetch failed: ${err.message}`);
  process.exit(1);
});
