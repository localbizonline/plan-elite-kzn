#!/usr/bin/env node
// ============================================================================
// sync.mjs
// ============================================================================
// Fetches current Airtable data, diffs against existing client-config.json,
// and applies changed business-data fields via the idempotent config writer.
// Then rebuilds and pushes to GitHub (Netlify auto-redeploys).
//
// Scope: identity, contact, address fields only — NOT AI-generated content
// (services, FAQs, about paragraphs, etc. are untouched).
//
// Usage:
//   node scripts/sync.mjs --project /path/to/project
//   node scripts/sync.mjs --project /path/to/project --dry-run
//
// Requires: AIRTABLE_TOKEN env var
// ============================================================================

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { replaceKeyValue, replaceNumericValue, readConfig, writeConfig } from './lib/config-writer.mjs';
import { buildLog } from './lib/build-logger.mjs';
import { runScript, runCommand, parseCliArgs } from './lib/runner-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Fields that sync touches — identity, contact, address only
const SYNC_FIELDS = [
  'companyName', 'phone', 'whatsapp', 'email',
  'ownerFirstName', 'ownerLastName', 'yearStarted',
  'primaryCity', 'website',
  'Google Maps URL',
];

function formatPhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

function phoneToRaw(phone) {
  return phone ? phone.replace(/\D/g, '') : null;
}

function phoneToWhatsApp(phone) {
  if (!phone) return null;
  const raw = phone.replace(/\D/g, '');
  if (raw.startsWith('0') && raw.length === 10) {
    return '27' + raw.slice(1);
  }
  return raw;
}

/**
 * Diff two client-config objects and return changed sync-scoped fields.
 */
function diffConfigs(oldConfig, newConfig) {
  const changes = [];
  for (const field of SYNC_FIELDS) {
    const oldVal = JSON.stringify(oldConfig[field] ?? null);
    const newVal = JSON.stringify(newConfig[field] ?? null);
    if (oldVal !== newVal) {
      changes.push({ field, old: oldConfig[field], new: newConfig[field] });
    }
  }
  return changes;
}

async function main() {
  const args = parseCliArgs();
  const projectPath = args.project ? resolve(args.project) : null;
  const dryRun = args['dry-run'] === true;

  if (!projectPath) {
    console.error('Usage: node scripts/sync.mjs --project /path/to/project [--dry-run]');
    process.exit(1);
  }

  if (!existsSync(projectPath)) {
    console.error(`Project not found: ${projectPath}`);
    process.exit(1);
  }

  const existingConfigPath = join(projectPath, 'client-config.json');
  if (!existsSync(existingConfigPath)) {
    console.error('client-config.json not found — is this a valid build project?');
    process.exit(1);
  }

  const log = buildLog(projectPath);
  const oldConfig = JSON.parse(readFileSync(existingConfigPath, 'utf-8'));

  // Fetch fresh data from Airtable
  console.log('Fetching latest data from Airtable...');
  const tmpOutput = join(projectPath, 'client-config-new.json');
  const fetchArgs = ['--output', tmpOutput];

  // Determine how to fetch — use record ID if available in old config
  if (oldConfig.recordId) {
    fetchArgs.push('--record-id', oldConfig.recordId);
  } else if (oldConfig.companyName) {
    fetchArgs.push('--company', oldConfig.companyName);
  } else {
    console.error('Cannot determine Airtable record — no recordId or companyName in client-config.json');
    process.exit(1);
  }

  runScript(join(__dirname, 'fetch-airtable.mjs'), fetchArgs);
  const newConfig = JSON.parse(readFileSync(tmpOutput, 'utf-8'));

  // Diff
  const changes = diffConfigs(oldConfig, newConfig);

  if (changes.length === 0) {
    console.log('\nNo changes detected — site is up to date.');
    // Clean up temp file
    try { writeFileSync(tmpOutput, ''); } catch {}
    process.exit(0);
  }

  console.log(`\n${changes.length} field(s) changed:`);
  for (const change of changes) {
    console.log(`  ${change.field}: ${JSON.stringify(change.old)} → ${JSON.stringify(change.new)}`);
  }

  if (dryRun) {
    console.log('\n--dry-run: No changes applied.');
    process.exit(0);
  }

  // Apply changes to site.config.ts
  console.log('\nApplying changes to site.config.ts...');
  let config = readConfig(projectPath);
  let applied = 0;

  for (const change of changes) {
    const newVal = change.new;
    if (newVal == null) continue;

    switch (change.field) {
      case 'companyName': {
        const updated = replaceKeyValue(config, 'name', newVal);
        if (updated !== config) { config = updated; applied++; }
        break;
      }
      case 'phone': {
        const formatted = formatPhone(newVal);
        const raw = phoneToRaw(newVal);
        if (formatted) {
          const u1 = replaceKeyValue(config, 'phone', formatted);
          if (u1 !== config) { config = u1; applied++; }
        }
        if (raw) {
          const u2 = replaceKeyValue(config, 'phoneRaw', raw);
          if (u2 !== config) { config = u2; applied++; }
        }
        break;
      }
      case 'whatsapp': {
        const wa = phoneToWhatsApp(newVal);
        if (wa) {
          const updated = replaceKeyValue(config, 'whatsapp', wa);
          if (updated !== config) { config = updated; applied++; }
        }
        break;
      }
      case 'email': {
        const updated = replaceKeyValue(config, 'email', newVal);
        if (updated !== config) { config = updated; applied++; }
        break;
      }
      case 'ownerFirstName':
      case 'ownerLastName': {
        const first = change.field === 'ownerFirstName' ? newVal : (newConfig.ownerFirstName || oldConfig.ownerFirstName || '');
        const last = change.field === 'ownerLastName' ? newVal : (newConfig.ownerLastName || oldConfig.ownerLastName || '');
        const founder = last ? `${first} ${last}` : first;
        const updated = replaceKeyValue(config, 'founder', founder);
        if (updated !== config) { config = updated; applied++; }
        break;
      }
      case 'yearStarted': {
        const updated = replaceKeyValue(config, 'foundingYear', newVal);
        if (updated !== config) { config = updated; applied++; }
        break;
      }
      case 'primaryCity': {
        const updated = replaceKeyValue(config, 'city', newVal);
        if (updated !== config) { config = updated; applied++; }
        break;
      }
      case 'website': {
        const updated = replaceKeyValue(config, 'url', newVal);
        if (updated !== config) { config = updated; applied++; }
        break;
      }
      case 'Google Maps URL': {
        const updated = replaceKeyValue(config, 'mapsEmbed', newVal);
        if (updated !== config) { config = updated; applied++; }
        break;
      }
    }
  }

  writeConfig(projectPath, config);
  console.log(`  ${applied} config values updated`);

  // Update client-config.json with fresh data
  writeFileSync(existingConfigPath, JSON.stringify(newConfig, null, 2), 'utf-8');
  console.log('  client-config.json updated');

  // Clean up temp
  try { writeFileSync(tmpOutput, ''); } catch {}

  log.info('sync', `Synced ${changes.length} field(s) from Airtable, ${applied} config values updated`);

  // Rebuild
  console.log('\nRebuilding...');
  runCommand('npm run build', { cwd: projectPath, timeout: 300_000 });

  // Push to GitHub (triggers Netlify redeploy)
  console.log('\nPushing to GitHub...');
  try {
    runCommand('git add -A && git commit -m "sync: update from Airtable" && git push', {
      cwd: projectPath,
      timeout: 60_000,
    });
    console.log('  Pushed — Netlify will auto-redeploy');
  } catch (err) {
    console.log(`  Git push failed (may need manual push): ${err.message}`);
  }

  log.info('sync', 'Sync complete — site rebuilt and pushed');
  console.log('\nSync complete.');
}

main().catch(err => {
  console.error(`Sync failed: ${err.message}`);
  process.exit(1);
});
