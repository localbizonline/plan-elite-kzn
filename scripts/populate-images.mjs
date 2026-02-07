#!/usr/bin/env node
// ============================================================================
// populate-images.mjs
// ============================================================================
// Downloads client images from Airtable URLs and places them in the correct
// convention-based folders. No codegen needed — src/images.ts uses
// import.meta.glob() to auto-discover images at build time.
//
// Usage:
//   node scripts/populate-images.mjs --project /path --data client-config.json
//
// Input: client-config.json with logo, headshot, gallery attachment URLs
// Output: Images in src/assets/images/{folder}/
//
// Folder conventions:
//   logo/          ← Business logo
//   headshot/      ← Owner headshot
//   gallery/       ← Homepage gallery (prefix-sorted: 01-*, 02-*, ...)
//   home-hero/     ← Homepage hero (first gallery image copied here)
// ============================================================================

import { readFileSync, writeFileSync, existsSync, mkdirSync, createWriteStream, copyFileSync } from 'node:fs';
import { resolve, join, extname, basename } from 'node:path';
import { get as httpsGet } from 'node:https';
import { get as httpGet } from 'node:http';
import { buildLog } from './lib/build-logger.mjs';
import { retry } from './lib/runner-utils.mjs';

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

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const getter = url.startsWith('https') ? httpsGet : httpGet;
    const file = createWriteStream(dest);
    getter(url, (response) => {
      // Follow redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close();
        download(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        file.close();
        reject(new Error(`HTTP ${response.statusCode} for ${url}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => { file.close(); resolve(dest); });
    }).on('error', reject);
  });
}

function getExtension(url, fallback = '.jpg') {
  try {
    const pathname = new URL(url).pathname;
    const ext = extname(pathname);
    if (['.jpg', '.jpeg', '.png', '.webp', '.svg', '.gif'].includes(ext.toLowerCase())) {
      return ext.toLowerCase();
    }
  } catch {}
  return fallback;
}

async function downloadImages(data, projectDir) {
  const imagesDir = join(projectDir, 'src/assets/images');
  const results = { logo: null, headshot: null, gallery: [] };

  // Ensure convention-based directories exist
  for (const sub of ['logo', 'headshot', 'gallery', 'home-hero', 'inner-hero', 'service-areas']) {
    mkdirSync(join(imagesDir, sub), { recursive: true });
  }

  const log = buildLog(projectDir);

  // Download logo → logo/
  const logoUrl = extractUrl(data.logo || data['Partner Logo']);
  if (logoUrl) {
    const ext = getExtension(logoUrl, '.png');
    const dest = join(imagesDir, 'logo', `logo${ext}`);
    try {
      await retry(() => download(logoUrl, dest), 3, 'Logo download');
      results.logo = `logo/logo${ext}`;
      log.info('populate-images', 'Logo downloaded from Airtable');
      console.log(`  ✓ Logo downloaded → logo/`);
    } catch (e) {
      log.error('populate-images', `Logo download failed: ${e.message}`);
      console.error(`  ✗ Logo download failed: ${e.message}`);
    }
  } else {
    log.missing('populate-images', 'No logo URL in Airtable data — needs AI generation');
  }

  // Download headshot → headshot/
  const headshotUrl = extractUrl(data.headshot || data['Partner Headshot']);
  if (headshotUrl) {
    const ext = getExtension(headshotUrl);
    const dest = join(imagesDir, 'headshot', `headshot${ext}`);
    try {
      await retry(() => download(headshotUrl, dest), 3, 'Headshot download');
      results.headshot = `headshot/headshot${ext}`;
      log.info('populate-images', 'Headshot downloaded from Airtable');
      console.log(`  ✓ Headshot downloaded → headshot/`);
    } catch (e) {
      log.error('populate-images', `Headshot download failed: ${e.message}`);
      console.error(`  ✗ Headshot download failed: ${e.message}`);
    }
  } else {
    log.missing('populate-images', 'No headshot URL in Airtable data — needs AI generation or skip');
  }

  // Download gallery images → gallery/ (prefix-sorted)
  const gallery = extractGallery(data.gallery || data['Gallery']);
  if (gallery.length === 0) {
    log.missing('populate-images', 'No gallery images in Airtable data — needs AI generation');
  }
  for (let i = 0; i < gallery.length; i++) {
    const url = gallery[i];
    const ext = getExtension(url);
    const prefix = String(i + 1).padStart(2, '0');
    const dest = join(imagesDir, 'gallery', `${prefix}-gallery${ext}`);
    try {
      await retry(() => download(url, dest), 3, `Gallery image ${i + 1}`);
      results.gallery.push({ path: `gallery/${prefix}-gallery${ext}`, fullPath: dest });
      console.log(`  ✓ Gallery image ${i + 1} downloaded → gallery/${prefix}-gallery${ext}`);
    } catch (e) {
      log.error('populate-images', `Gallery image ${i + 1} download failed: ${e.message}`);
      console.error(`  ✗ Gallery image ${i + 1} failed: ${e.message}`);
    }
  }

  // Copy first gallery image to home-hero/ (homepage hero uses gallery-1 by convention)
  if (results.gallery.length > 0) {
    const firstGallery = results.gallery[0].fullPath;
    const ext = extname(firstGallery);
    const heroDest = join(imagesDir, 'home-hero', `home-hero${ext}`);
    try {
      copyFileSync(firstGallery, heroDest);
      console.log(`  ✓ Home hero set from first gallery image → home-hero/`);
    } catch (e) {
      log.error('populate-images', `Failed to copy gallery-1 to home-hero: ${e.message}`);
    }
  }

  log.info('populate-images', `Download complete: logo=${!!results.logo}, headshot=${!!results.headshot}, gallery=${results.gallery.length}`);
  return results;
}

/**
 * Extract URL from Airtable attachment field.
 * Can be a string URL, an object with {url}, or an array of objects.
 */
function extractUrl(field) {
  if (!field) return null;
  if (typeof field === 'string') return field;
  if (Array.isArray(field) && field.length > 0) {
    return field[0].url || field[0];
  }
  if (field.url) return field.url;
  return null;
}

function extractGallery(field) {
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

async function main() {
  const args = parseArgs();
  const projectDir = args.project || process.cwd();
  const dataFile = args.data;

  if (!dataFile) {
    console.error('Error: --data is required (path to client config JSON)');
    process.exit(1);
  }

  if (!existsSync(resolve(dataFile))) {
    console.error(`Error: Data file not found: ${dataFile}`);
    process.exit(1);
  }

  const data = JSON.parse(readFileSync(resolve(dataFile), 'utf-8'));

  console.log('Downloading client images...');
  const results = await downloadImages(data, projectDir);

  // No codegen needed — src/images.ts uses import.meta.glob() for auto-discovery
  console.log(`\n✓ Images placed in convention-based folders (auto-discovered by images.ts)`);

  console.log(`\nImage slots that still need AI generation:`);
  if (!results.logo) console.log(`  - Logo (no logo in Airtable)`);
  if (!results.headshot) console.log(`  - Headshot (no headshot in Airtable)`);
  if (results.gallery.length === 0) console.log(`  - Gallery images (no gallery in Airtable)`);
  console.log(`  - Service images (always need generation for each service)`);
  console.log(`  - Inner hero + service-areas hero (always need generation)`);
  console.log(`\nUse the image-workflow skill or fal-images skill to generate missing images.`);
}

main();
