#!/usr/bin/env node
// ============================================================================
// download-fonts.mjs
// ============================================================================
// Reads font names from site.config.ts theme and downloads woff2 files from
// Google Fonts. Also updates the FONT_FILES registry in generate-theme.mjs.
//
// Usage:
//   node scripts/download-fonts.mjs --project /path/to/project
//
// Reads:  src/site.config.ts (displayFont, bodyFont)
// Writes: public/fonts/*.woff2, scripts/generate-theme.mjs (FONT_FILES)
//
// Requires: Internet access (fetches from Google Fonts CSS API)
// ============================================================================

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import https from 'node:https';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Extract font names from site.config.ts
// ---------------------------------------------------------------------------
function extractFontNames(configPath) {
  const content = readFileSync(configPath, 'utf-8');
  const displayMatch = content.match(/displayFont:\s*["']([^"']+)["']/);
  const bodyMatch = content.match(/bodyFont:\s*["']([^"']+)["']/);
  return {
    displayFont: displayMatch?.[1] || null,
    bodyFont: bodyMatch?.[1] || null,
  };
}

// ---------------------------------------------------------------------------
// HTTPS GET helper (returns a promise)
// ---------------------------------------------------------------------------
function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      // Follow redirects
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

// ---------------------------------------------------------------------------
// Fetch Google Fonts CSS and parse woff2 URLs + metadata
// ---------------------------------------------------------------------------
async function fetchGoogleFontCss(fontFamily, weights = [400, 600, 700]) {
  // Google Fonts CSS2 API — request woff2 by sending a modern user-agent
  // Format: family=Font+Name:wght@400;600;700 (weights joined without repeating wght@)
  const weightList = `wght@${weights.join(';')}`;
  const familyParam = encodeURIComponent(fontFamily);
  const url = `https://fonts.googleapis.com/css2?family=${familyParam}:${weightList}&display=swap`;

  const css = await httpsGet(url, {
    // Must send a modern user-agent to get woff2 format
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  });

  const cssText = css.toString('utf-8');

  // Parse @font-face blocks
  const faces = [];
  const blockRegex = /@font-face\s*\{([^}]+)\}/g;
  let match;
  while ((match = blockRegex.exec(cssText)) !== null) {
    const block = match[1];
    const srcMatch = block.match(/src:\s*url\(([^)]+)\)/);
    const weightMatch = block.match(/font-weight:\s*(\d+)/);
    const styleMatch = block.match(/font-style:\s*(\w+)/);
    const unicodeMatch = block.match(/unicode-range:\s*([^;]+)/);

    if (srcMatch && weightMatch) {
      // Only take latin range (skip extended, vietnamese, etc.)
      const range = unicodeMatch?.[1]?.trim() || '';
      const isLatin = !range || range.includes('U+0000-00FF') || range.includes('U+0100');

      // Prefer the main latin block (U+0000-00FF)
      const isMainLatin = range.includes('U+0000-00FF');

      faces.push({
        url: srcMatch[1],
        weight: weightMatch[1],
        style: styleMatch?.[1] || 'normal',
        unicodeRange: range,
        isLatin,
        isMainLatin,
      });
    }
  }

  // Deduplicate: prefer main latin, then any latin, for each weight
  const byWeight = {};
  for (const face of faces) {
    const key = `${face.weight}-${face.style}`;
    if (!byWeight[key] || (face.isMainLatin && !byWeight[key].isMainLatin)) {
      byWeight[key] = face;
    }
  }

  return Object.values(byWeight).filter((f) => f.isLatin);
}

// ---------------------------------------------------------------------------
// Download a single woff2 file
// ---------------------------------------------------------------------------
async function downloadFont(url, destPath) {
  const data = await httpsGet(url);
  writeFileSync(destPath, data);
  return data.length;
}

// ---------------------------------------------------------------------------
// Build a filename for the font: e.g. "barlow-condensed-v1-latin-700.woff2"
// ---------------------------------------------------------------------------
function buildFilename(fontFamily, weight) {
  const slug = fontFamily
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const weightLabel = weight === '400' ? 'regular' : weight;
  return `${slug}-latin-${weightLabel}.woff2`;
}

// ---------------------------------------------------------------------------
// Update FONT_FILES in generate-theme.mjs
// ---------------------------------------------------------------------------
function updateFontRegistry(generateThemePath, fontName, faces) {
  let content = readFileSync(generateThemePath, 'utf-8');

  // Check if font already registered
  if (content.includes(`'${fontName}':`)) {
    console.log(`  ℹ  "${fontName}" already in FONT_FILES — updating`);
    // Remove existing entry and re-add
    const entryRegex = new RegExp(
      `  '${fontName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}':\\s*\\{[\\s\\S]*?\\},?\\n`,
    );
    content = content.replace(entryRegex, '');
  }

  // Build new entry
  const facesStr = faces
    .map((f) => `      { weight: '${f.weight === '400' ? 'regular' : f.weight}', file: '${f.file}' }`)
    .join(',\n');

  const newEntry = `  '${fontName}': {\n    faces: [\n${facesStr},\n    ],\n  },\n`;

  // Insert before the closing `};` of FONT_FILES — find it specifically
  // Look for `const FONT_FILES = {` then find its matching `};`
  const fontFilesStart = content.indexOf('const FONT_FILES = {');
  if (fontFilesStart === -1) {
    console.error('  ✗ Could not find "const FONT_FILES = {" in generate-theme.mjs');
    return false;
  }
  // Find the closing `};` after FONT_FILES declaration by counting braces
  let braceDepth = 0;
  let insertPoint = -1;
  for (let i = content.indexOf('{', fontFilesStart); i < content.length; i++) {
    if (content[i] === '{') braceDepth++;
    if (content[i] === '}') {
      braceDepth--;
      if (braceDepth === 0) {
        insertPoint = i; // points to the `}` of FONT_FILES
        break;
      }
    }
  }
  if (insertPoint === -1) {
    console.error('  ✗ Could not find FONT_FILES closing brace in generate-theme.mjs');
    return false;
  }

  content = content.slice(0, insertPoint) + newEntry + content.slice(insertPoint);
  writeFileSync(generateThemePath, content, 'utf-8');
  return true;
}

// ---------------------------------------------------------------------------
// Process a single font family
// ---------------------------------------------------------------------------
async function processFont(fontName, fontsDir, generateThemePath) {
  console.log(`\n  → Fetching "${fontName}" from Google Fonts...`);

  // Request common weights: 400 (regular), 600 (semi-bold), 700 (bold)
  const weights = [400, 600, 700];
  let faces;
  try {
    faces = await fetchGoogleFontCss(fontName, weights);
  } catch (err) {
    console.error(`  ✗ Failed to fetch CSS for "${fontName}": ${err.message}`);
    return false;
  }

  if (faces.length === 0) {
    console.error(`  ✗ No woff2 faces found for "${fontName}" — is the name correct?`);
    return false;
  }

  console.log(`  ✓ Found ${faces.length} weight(s): ${faces.map((f) => f.weight).join(', ')}`);

  const downloadedFaces = [];
  for (const face of faces) {
    const filename = buildFilename(fontName, face.weight);
    const destPath = join(fontsDir, filename);

    // Skip if already downloaded
    if (existsSync(destPath)) {
      console.log(`  ℹ  ${filename} already exists — skipping download`);
      downloadedFaces.push({ weight: face.weight, file: filename });
      continue;
    }

    try {
      const size = await downloadFont(face.url, destPath);
      console.log(`  ✓ Downloaded ${filename} (${(size / 1024).toFixed(1)} KB)`);
      downloadedFaces.push({ weight: face.weight, file: filename });
    } catch (err) {
      console.error(`  ✗ Failed to download ${filename}: ${err.message}`);
    }
  }

  // Update FONT_FILES registry
  if (downloadedFaces.length > 0 && generateThemePath) {
    const updated = updateFontRegistry(generateThemePath, fontName, downloadedFaces);
    if (updated) {
      console.log(`  ✓ FONT_FILES registry updated for "${fontName}"`);
    }
  }

  return downloadedFaces.length > 0;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const args = parseArgs();
  const projectDir = args.project || process.cwd();

  console.log('\n═══ Google Fonts Downloader ═══');

  // 1. Read font names from site.config.ts
  const configPath = join(projectDir, 'src/site.config.ts');
  if (!existsSync(configPath)) {
    console.error(`\n✗ site.config.ts not found at: ${configPath}`);
    process.exit(1);
  }

  const { displayFont, bodyFont } = extractFontNames(configPath);
  if (!displayFont && !bodyFont) {
    console.error('\n✗ No displayFont or bodyFont found in site.config.ts theme');
    process.exit(1);
  }

  console.log(`\n  Display font: ${displayFont || '(not set)'}`);
  console.log(`  Body font:    ${bodyFont || '(not set)'}`);

  // 2. Ensure fonts directory exists
  const fontsDir = join(projectDir, 'public/fonts');
  if (!existsSync(fontsDir)) {
    mkdirSync(fontsDir, { recursive: true });
  }

  // 3. Path to generate-theme.mjs for registry updates
  const generateThemePath = join(projectDir, 'scripts/generate-theme.mjs');
  const hasGenerateTheme = existsSync(generateThemePath);
  if (!hasGenerateTheme) {
    console.warn('\n  ⚠ generate-theme.mjs not found — font registry will not be updated');
  }

  // 4. Process each unique font
  const fontsToProcess = [...new Set([displayFont, bodyFont].filter(Boolean))];
  let allSuccess = true;

  for (const fontName of fontsToProcess) {
    const ok = await processFont(fontName, fontsDir, hasGenerateTheme ? generateThemePath : null);
    if (!ok) allSuccess = false;
  }

  // 5. Summary
  if (allSuccess) {
    console.log('\n✓ All fonts downloaded and registered successfully.');
    console.log('  Next step: run `node scripts/generate-theme.mjs --project .` to regenerate global.css\n');
  } else {
    console.error('\n✗ Some fonts failed to download. Check errors above.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`\n✗ Unexpected error: ${err.message}`);
  process.exit(1);
});
