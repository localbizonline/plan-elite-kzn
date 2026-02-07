#!/usr/bin/env node
// ============================================================================
// download-all-fonts.mjs — ONE-TIME SCRIPT
// ============================================================================
// Downloads all 20 fonts from font-registry.json into public/fonts/.
// Run this once to populate the template. After that, fonts are pre-bundled.
//
// Usage:
//   node scripts/download-all-fonts.mjs
// ============================================================================

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = join(__dirname, '..');

function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpsGet(res.headers.location, headers).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

async function fetchGoogleFontCss(fontFamily, weights = [400, 600, 700]) {
  const weightList = `wght@${weights.join(';')}`;
  const familyParam = encodeURIComponent(fontFamily);
  const url = `https://fonts.googleapis.com/css2?family=${familyParam}:${weightList}&display=swap`;

  const css = await httpsGet(url, {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  });

  const cssText = css.toString('utf-8');
  const faces = [];
  const blockRegex = /@font-face\s*\{([^}]+)\}/g;
  let match;
  while ((match = blockRegex.exec(cssText)) !== null) {
    const block = match[1];
    const srcMatch = block.match(/src:\s*url\(([^)]+)\)/);
    const weightMatch = block.match(/font-weight:\s*(\d+)/);
    const unicodeMatch = block.match(/unicode-range:\s*([^;]+)/);
    if (srcMatch && weightMatch) {
      const range = unicodeMatch?.[1]?.trim() || '';
      const isMainLatin = range.includes('U+0000-00FF');
      faces.push({ url: srcMatch[1], weight: weightMatch[1], isMainLatin });
    }
  }

  // Deduplicate: prefer main latin block per weight
  const byWeight = {};
  for (const face of faces) {
    if (!byWeight[face.weight] || (face.isMainLatin && !byWeight[face.weight].isMainLatin)) {
      byWeight[face.weight] = face;
    }
  }
  return Object.values(byWeight);
}

async function main() {
  const registryPath = join(PROJECT_DIR, 'src/font-registry.json');
  const registry = JSON.parse(readFileSync(registryPath, 'utf-8'));
  const fontsDir = join(PROJECT_DIR, 'public/fonts');
  if (!existsSync(fontsDir)) mkdirSync(fontsDir, { recursive: true });

  const fonts = Object.entries(registry.fonts);
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  console.log(`\n═══ Downloading ${fonts.length} fonts (${fonts.length * 3} files) ═══\n`);

  for (const [slug, font] of fonts) {
    console.log(`\n[${slug}] ${font.family}`);

    // Check which files we already have
    const existingFiles = Object.values(font.files).filter(f => existsSync(join(fontsDir, f)));
    if (existingFiles.length === Object.keys(font.files).length) {
      console.log(`  ✓ All files already exist — skipping`);
      skipped += Object.keys(font.files).length;
      continue;
    }

    // Determine which weights to request
    const weights = Object.keys(font.files).map(Number);
    let faces;
    try {
      faces = await fetchGoogleFontCss(font.family, weights);
    } catch (err) {
      console.error(`  ✗ Failed to fetch CSS: ${err.message}`);
      failed += weights.length;
      continue;
    }

    console.log(`  Found ${faces.length} weight(s): ${faces.map(f => f.weight).join(', ')}`);

    for (const face of faces) {
      const expectedFile = font.files[face.weight] || font.files[face.weight === '400' ? '400' : face.weight];
      if (!expectedFile) {
        console.log(`  ⚠ Unexpected weight ${face.weight} — skipping`);
        continue;
      }
      const destPath = join(fontsDir, expectedFile);
      if (existsSync(destPath)) {
        console.log(`  ✓ ${expectedFile} already exists`);
        skipped++;
        continue;
      }
      try {
        const data = await httpsGet(face.url);
        writeFileSync(destPath, data);
        console.log(`  ✓ ${expectedFile} (${(data.length / 1024).toFixed(1)} KB)`);
        downloaded++;
      } catch (err) {
        console.error(`  ✗ ${expectedFile}: ${err.message}`);
        failed++;
      }
    }
  }

  console.log(`\n═══ Summary ═══`);
  console.log(`  Downloaded: ${downloaded}`);
  console.log(`  Skipped:    ${skipped}`);
  console.log(`  Failed:     ${failed}`);
  console.log(`  Font dir:   ${fontsDir}\n`);
}

main().catch(err => { console.error(err); process.exit(1); });
