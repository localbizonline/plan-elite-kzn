#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { buildLog } from './build-logger.mjs';

// ============================================================================
// image-qa.mjs
// ============================================================================
// Deterministic image integrity checks for template-based builds.
// Validates file existence, sizes, uniqueness (MD5 hashes), and import wiring.
// Writes image-qa-results.json and logs to BUILD-LOG.md.
//
// Usage:
//   node scripts/lib/image-qa.mjs --project /path [--attempt 1]
//
// Exit code: 0 = pass, 1 = errors found
// ============================================================================

const IMAGES_BASE = 'src/assets/images';
const IMAGE_EXTS = /\.(jpg|jpeg|png|webp|avif|svg|gif)$/i;
const PLACEHOLDER_THRESHOLD = 1024;   // < 1KB = placeholder stub
const SUSPICIOUS_THRESHOLD = 10240;   // < 10KB = suspiciously small

// --- Image discovery ---

/**
 * Extract service slugs from site.config.ts
 * @param {string} projectPath
 * @returns {string[]}
 */
function discoverServiceSlugs(projectPath) {
  const configPath = path.join(projectPath, 'src', 'site.config.ts');
  if (!fs.existsSync(configPath)) return [];
  const content = fs.readFileSync(configPath, 'utf-8');
  return [...content.matchAll(/slug:\s*["']([^"']+)["']/g)].map(m => m[1]);
}

/**
 * Build the expected image folder list based on conventions
 * @param {string} projectPath
 * @returns {{ folder: string, role: string, required: boolean }[]}
 */
function buildExpectedFolders(projectPath) {
  const slugs = discoverServiceSlugs(projectPath);
  const folders = [
    { folder: 'home-hero', role: 'Homepage hero', required: true },
    { folder: 'inner-hero', role: 'Inner page hero', required: true },
    { folder: 'gallery', role: 'Gallery images', required: true },
  ];

  for (const slug of slugs) {
    for (const placement of ['card', 'hero', 'content']) {
      folders.push({
        folder: `services/${slug}/${placement}`,
        role: `Service "${slug}" ${placement} image`,
        required: true,
      });
    }
  }

  return folders;
}

// --- File checks ---

/**
 * List real image files in a directory (non-recursive)
 * @param {string} dir
 * @returns {{ name: string, size: number, path: string }[]}
 */
function listImages(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => IMAGE_EXTS.test(f))
    .map(f => {
      const full = path.join(dir, f);
      return { name: f, size: fs.statSync(full).size, path: full };
    });
}

/**
 * MD5 hash a file
 * @param {string} filePath
 * @returns {string}
 */
function hashFile(filePath) {
  const data = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(data).digest('hex');
}

/**
 * Check all expected image folders for existence, sizes, and placeholders
 * @param {string} projectPath
 * @returns {{ errors: Array, warnings: Array, found: number, placeholders: number, inventory: object }}
 */
function checkImageFolders(projectPath) {
  const imagesBase = path.join(projectPath, IMAGES_BASE);
  const expected = buildExpectedFolders(projectPath);
  const errors = [];
  const warnings = [];
  let found = 0;
  let placeholders = 0;
  const inventory = { generated: [], brand: [], gallery: [] };

  for (const { folder, role, required } of expected) {
    const dir = path.join(imagesBase, folder);

    if (!fs.existsSync(dir)) {
      if (required) {
        errors.push({ check: 'missing-folder', detail: `${folder}/ does not exist (${role})` });
      }
      continue;
    }

    const images = listImages(dir);
    if (images.length === 0) {
      if (required) {
        errors.push({ check: 'empty-folder', detail: `${folder}/ has no images (${role})` });
      }
      continue;
    }

    for (const img of images) {
      found++;
      if (img.size < PLACEHOLDER_THRESHOLD) {
        placeholders++;
        errors.push({ check: 'placeholder', detail: `${folder}/${img.name} is ${img.size}B (placeholder stub < 1KB)` });
      } else if (img.size < SUSPICIOUS_THRESHOLD) {
        warnings.push({ check: 'small-image', detail: `${folder}/${img.name} is ${(img.size / 1024).toFixed(1)}KB (suspiciously small)` });
      }

      // Categorize
      if (folder.startsWith('services/')) {
        inventory.generated.push(`${folder}/${img.name}`);
      } else if (folder === 'gallery') {
        inventory.gallery.push(`${folder}/${img.name}`);
      } else {
        inventory.brand.push(`${folder}/${img.name}`);
      }
    }
  }

  // Brand images (top-level — logo, headshot, og)
  for (const brandFile of ['logo', 'headshot']) {
    const brandDir = path.join(imagesBase, brandFile);
    if (fs.existsSync(brandDir)) {
      const imgs = listImages(brandDir);
      if (imgs.length > 0) {
        found += imgs.length;
        for (const img of imgs) {
          inventory.brand.push(`${brandFile}/${img.name}`);
          if (img.size < PLACEHOLDER_THRESHOLD) {
            placeholders++;
            errors.push({ check: 'placeholder', detail: `${brandFile}/${img.name} is ${img.size}B (placeholder)` });
          }
        }
      } else {
        warnings.push({ check: 'missing-brand', detail: `No ${brandFile} image found` });
      }
    } else {
      warnings.push({ check: 'missing-brand', detail: `${brandFile}/ folder does not exist` });
    }
  }

  return { errors, warnings, found, placeholders, inventory };
}

/**
 * Hash all images and detect duplicates across service placements
 * @param {string} projectPath
 * @returns {{ errors: Array, duplicates: number }}
 */
function checkImageUniqueness(projectPath) {
  const imagesBase = path.join(projectPath, IMAGES_BASE);
  const slugs = discoverServiceSlugs(projectPath);
  const errors = [];
  let duplicates = 0;

  for (const slug of slugs) {
    const placements = ['card', 'hero', 'content'];
    const hashes = {};

    for (const placement of placements) {
      const dir = path.join(imagesBase, 'services', slug, placement);
      const images = listImages(dir);
      if (images.length > 0) {
        const hash = hashFile(images[0].path);
        hashes[placement] = hash;
      }
    }

    // Check for duplicates across placements
    const hashValues = Object.values(hashes);
    const uniqueHashes = new Set(hashValues);

    if (hashValues.length >= 2 && uniqueHashes.size === 1) {
      duplicates++;
      errors.push({
        check: 'service-images-identical',
        detail: `All images for service "${slug}" are identical (same MD5 hash)`,
      });
    } else if (hashValues.length >= 2) {
      // Check pairwise
      const entries = Object.entries(hashes);
      for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
          if (entries[i][1] === entries[j][1]) {
            duplicates++;
            errors.push({
              check: 'image-duplicate',
              detail: `Service "${slug}": ${entries[i][0]} and ${entries[j][0]} are identical`,
            });
          }
        }
      }
    }
  }

  // Also check hero images aren't duplicated across services
  const heroHashes = new Map();
  for (const slug of slugs) {
    const dir = path.join(imagesBase, 'services', slug, 'hero');
    const images = listImages(dir);
    if (images.length > 0) {
      const hash = hashFile(images[0].path);
      if (heroHashes.has(hash)) {
        duplicates++;
        errors.push({
          check: 'image-duplicate',
          detail: `Hero images identical: "${slug}" and "${heroHashes.get(hash)}"`,
        });
      } else {
        heroHashes.set(hash, slug);
      }
    }
  }

  return { errors, duplicates };
}

/**
 * Verify images.ts glob patterns discover all folders
 * @param {string} projectPath
 * @returns {{ errors: Array, missingImports: number }}
 */
function checkImportsValidity(projectPath) {
  const imagesTs = path.join(projectPath, 'src', 'images.ts');
  const errors = [];
  let missingImports = 0;

  if (!fs.existsSync(imagesTs)) {
    errors.push({ check: 'missing-images-ts', detail: 'src/images.ts does not exist' });
    return { errors, missingImports: 1 };
  }

  const content = fs.readFileSync(imagesTs, 'utf-8');

  // Check it uses glob-based discovery
  if (!content.includes('import.meta.glob')) {
    errors.push({ check: 'no-glob', detail: 'images.ts does not use import.meta.glob() — may miss images' });
    missingImports++;
  }

  // Check that key image folders are covered by globs
  const imagesBase = path.join(projectPath, IMAGES_BASE);
  const requiredFolders = ['home-hero', 'inner-hero', 'gallery', 'services'];
  for (const folder of requiredFolders) {
    const dir = path.join(imagesBase, folder);
    if (fs.existsSync(dir)) {
      // Verify that the glob pattern in images.ts would match this folder
      // Glob patterns like './assets/images/**/*.{jpg,png,webp}' cover nested folders
      // We just verify the base images path is referenced
      if (!content.includes('assets/images')) {
        errors.push({ check: 'glob-path', detail: `images.ts may not discover ${folder}/ — no assets/images path in glob` });
        missingImports++;
        break; // only report once
      }
    }
  }

  return { errors, missingImports };
}

// --- Main ---

/**
 * Run full image QA
 * @param {string} projectPath
 * @param {number} attemptNumber
 * @returns {object}
 */
export function runImageQa(projectPath, attemptNumber = 1) {
  const log = buildLog(projectPath);
  log.info('image-qa', `Starting image QA attempt ${attemptNumber}`);

  // 1. Check folders, sizes, placeholders
  const folderCheck = checkImageFolders(projectPath);

  // 2. Uniqueness
  const uniquenessCheck = checkImageUniqueness(projectPath);

  // 3. Import wiring
  const importCheck = checkImportsValidity(projectPath);

  // Merge
  const allErrors = [...folderCheck.errors, ...uniquenessCheck.errors, ...importCheck.errors];
  const allWarnings = [...folderCheck.warnings];
  const passed = allErrors.length === 0;

  const slugs = discoverServiceSlugs(projectPath);
  const expectedImages = slugs.length * 3 + 3; // 3 per service + home-hero + inner-hero + gallery(1+)

  const result = {
    timestamp: new Date().toISOString(),
    attempt: attemptNumber,
    agent: 'image-qa',
    summary: {
      expectedImages,
      found: folderCheck.found,
      placeholders: folderCheck.placeholders,
      duplicates: uniquenessCheck.duplicates,
      missingImports: importCheck.missingImports,
      errors: allErrors.length,
      warnings: allWarnings.length,
    },
    passed,
    errors: allErrors,
    warnings: allWarnings,
    imageInventory: folderCheck.inventory,
  };

  // Write result file
  const resultPath = path.join(projectPath, 'image-qa-results.json');
  fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));

  // Log summary
  log[passed ? 'info' : 'error'](
    'image-qa',
    `Image QA attempt ${attemptNumber}: ${allErrors.length} errors, ${allWarnings.length} warnings. Found ${folderCheck.found} images, ${folderCheck.placeholders} placeholders, ${uniquenessCheck.duplicates} duplicates`
  );

  return result;
}

// --- CLI ---

const isDirectExecution = process.argv[1]?.endsWith('image-qa.mjs');
if (isDirectExecution) {
  const args = process.argv.slice(2);
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const val = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : 'true';
      flags[key] = val;
      if (val !== 'true') i++;
    }
  }

  const projectPath = flags.project || process.cwd();
  const attempt = parseInt(flags.attempt || '1', 10);

  console.log(`\nImage QA — ${projectPath}\n`);

  const result = runImageQa(projectPath, attempt);

  console.log(`\nExpected: ${result.summary.expectedImages} | Found: ${result.summary.found} | Placeholders: ${result.summary.placeholders} | Duplicates: ${result.summary.duplicates}`);
  console.log(`Errors: ${result.summary.errors} | Warnings: ${result.summary.warnings}`);

  if (result.errors.length > 0) {
    console.log('\nERRORS:');
    for (const e of result.errors) console.log(`  ✗ [${e.check}] ${e.detail}`);
  }
  if (result.warnings.length > 0) {
    console.log('\nWARNINGS:');
    for (const w of result.warnings) console.log(`  ⚠ [${w.check}] ${w.detail}`);
  }

  console.log(result.passed ? '\nImage QA PASSED' : '\nImage QA FAILED');
  console.log(`Results: image-qa-results.json`);
  process.exit(result.passed ? 0 : 1);
}
