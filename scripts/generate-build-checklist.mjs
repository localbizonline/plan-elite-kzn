#!/usr/bin/env node
// ============================================================================
// generate-build-checklist.mjs
// ============================================================================
// Reads all build artifacts and produces BUILD-CHECKLIST.md with pass/fail
// for every mandatory requirement. Run after Phase 7.6 (final rebuild).
//
// Usage:
//   node scripts/generate-build-checklist.mjs --project /path/to/project
//
// Output:
//   BUILD-CHECKLIST.md written to project root
//   Exit code: 0 (always — this is informational)
// ============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { buildLog } from './lib/build-logger.mjs';
import { isValidHex, calculateContrast } from './lib/color-utils.mjs';

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
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
const log = buildLog(projectPath);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function readJSON(filename) {
  const p = path.join(projectPath, filename);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; }
}

function readText(filename) {
  const p = path.join(projectPath, filename);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, 'utf-8');
}

function fileExists(relativePath) {
  return fs.existsSync(path.join(projectPath, relativePath));
}

function fileSize(relativePath) {
  const p = path.join(projectPath, relativePath);
  if (!fs.existsSync(p)) return 0;
  return fs.statSync(p).size;
}

function globDir(dir, ext) {
  const full = path.join(projectPath, dir);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full).filter(f => f.endsWith(ext)).map(f => path.join(dir, f));
}

// ---------------------------------------------------------------------------
// Check result accumulator
// ---------------------------------------------------------------------------
const results = { passed: 0, failed: 0, warned: 0, checks: [] };

function pass(section, message) {
  results.passed++;
  results.checks.push({ section, status: 'pass', message });
}
function fail(section, message) {
  results.failed++;
  results.checks.push({ section, status: 'fail', message });
}
function warn(section, message) {
  results.warned++;
  results.checks.push({ section, status: 'warn', message });
}

// ---------------------------------------------------------------------------
// PHASE STATUS CHECKS
// ---------------------------------------------------------------------------
const buildState = readJSON('build-state.json');

if (buildState) {
  const phases = buildState.phases || {};
  for (let i = 0; i <= 7; i++) {
    const id = `phase-${i}`;
    const phase = phases[id];
    const status = phase?.status;
    if (status === 'completed') {
      pass('Phases', `Phase ${i} completed`);
    } else if (status === 'failed') {
      fail('Phases', `Phase ${i} failed: ${phase?.error || 'unknown'}`);
    } else {
      warn('Phases', `Phase ${i} not completed (status: ${status || 'missing'})`);
    }
  }
} else {
  fail('Phases', 'build-state.json missing — build not initialized');
}

// ---------------------------------------------------------------------------
// REVIEW CHECKS
// ---------------------------------------------------------------------------
const reviews = readJSON('reviews.json');
const reviewsMd = readText('REVIEWS.md');

if (!reviewsMd) {
  fail('Reviews', 'REVIEWS.md missing (mandatory file)');
} else {
  pass('Reviews', 'REVIEWS.md exists');
}

if (reviews) {
  // Support multiple reviews.json formats:
  // Format A (teammate): { testimonials: [{quote, author}], aggregateRating: {google: {reviewCount}} }
  // Format B (data-collector): { sources: {google: {reviews: [{text}]}, localPros: {reviews: [{text}]}}, summary: {googleReviewCount} }
  // Format C (data-collector v2): { reviews: [{author, text, rating, source}], summary: {googleRating, totalTestimonials} }
  const allReviewTexts = [];

  // Format A
  if (reviews.testimonials) {
    for (const t of reviews.testimonials) {
      if ((t.quote || t.text) && (t.quote || t.text).length > 20) allReviewTexts.push(t);
    }
  }
  // Format B
  if (reviews.sources) {
    for (const source of Object.values(reviews.sources)) {
      if (source.reviews) {
        for (const r of source.reviews) {
          if ((r.text || r.quote) && (r.text || r.quote).length > 20) allReviewTexts.push(r);
        }
      }
    }
  }
  // Format C — root-level reviews array
  if (reviews.reviews && Array.isArray(reviews.reviews)) {
    for (const r of reviews.reviews) {
      if ((r.text || r.quote) && (r.text || r.quote).length > 20) allReviewTexts.push(r);
    }
  }

  if (allReviewTexts.length > 0) {
    pass('Reviews', `${allReviewTexts.length} reviews with actual text collected`);
  } else {
    warn('Reviews', 'reviews.json exists but no review text > 20 chars collected');
  }

  // Google reviews — support all formats
  const googleCount = reviews.reviewCounts?.google ||
    reviews.aggregateRating?.google?.reviewCount ||
    reviews.summary?.googleReviewCount ||
    reviews.sources?.google?.totalReviews || 0;
  const googleRating = reviews.aggregateRating?.google?.ratingValue ||
    reviews.aggregateRating?.google?.rating ||
    reviews.summary?.googleRating ||
    reviews.sources?.google?.rating || 0;
  const googleTexts = reviews.sources?.google?.reviews?.length ||
    reviews.sources?.google?.reviewsCollected ||
    (reviews.reviews ? reviews.reviews.filter(r => r.source === 'Google' || r.source === 'Google Maps').length : 0) || 0;

  if (googleTexts > 0) {
    pass('Reviews', `Google: ${googleRating}/5, ${googleCount} total, ${googleTexts} texts retrieved`);
  } else if (googleCount > 0) {
    warn('Reviews', `Google: ${googleRating}/5, ${googleCount} reviews found but 0 texts retrieved (API issue)`);
  } else {
    warn('Reviews', 'No Google reviews found');
  }
} else {
  warn('Reviews', 'reviews.json missing — no reviews collected');
}

// ---------------------------------------------------------------------------
// DESIGN CHECKS
// ---------------------------------------------------------------------------
const designTokens = readJSON('design-tokens.json');

if (designTokens) {
  // Color validation
  const primary = designTokens.colors?.primary || designTokens.theme?.primary;
  const accent = designTokens.colors?.accent || designTokens.colors?.secondary || designTokens.theme?.accent;

  if (primary && isValidHex(primary)) {
    pass('Design', `Primary color: ${primary} (valid hex)`);
  } else if (primary) {
    fail('Design', `Primary color "${primary}" is not a valid hex code`);
  } else {
    fail('Design', 'No primary color defined in design-tokens.json');
  }

  if (accent && isValidHex(accent)) {
    pass('Design', `Accent color: ${accent} (valid hex)`);
  } else if (accent) {
    fail('Design', `Accent color "${accent}" is not a valid hex code`);
  } else {
    fail('Design', 'No accent color defined in design-tokens.json');
  }

  // Contrast check
  if (primary && accent && isValidHex(primary) && isValidHex(accent)) {
    const contrast = calculateContrast(primary, accent);
    if (contrast >= 3.0) {
      pass('Design', `Primary/accent contrast ratio: ${contrast.toFixed(1)}:1 (WCAG AA)`);
    } else if (contrast >= 2.0) {
      warn('Design', `Primary/accent contrast ratio: ${contrast.toFixed(1)}:1 (below WCAG AA 3:1)`);
    } else {
      fail('Design', `Primary/accent contrast ratio: ${contrast.toFixed(1)}:1 (too similar, < 2:1)`);
    }
  }

  // Font validation
  const headingFont = designTokens.fonts?.heading || designTokens.theme?.displayFont;
  const bodyFont = designTokens.fonts?.body || designTokens.theme?.bodyFont;

  if (headingFont) {
    pass('Design', `Heading font: ${headingFont}`);
  } else {
    fail('Design', 'No heading font defined in design-tokens.json');
  }

  if (bodyFont) {
    pass('Design', `Body font: ${bodyFont}`);
  } else {
    fail('Design', 'No body font defined in design-tokens.json');
  }

  // Font files check
  const fontFiles = globDir('public/fonts', '.woff2');
  if (fontFiles.length > 0) {
    pass('Design', `${fontFiles.length} font files downloaded in public/fonts/`);
  } else {
    // Also check .woff, .ttf
    const allFonts = [
      ...globDir('public/fonts', '.woff'),
      ...globDir('public/fonts', '.ttf'),
    ];
    if (allFonts.length > 0) {
      pass('Design', `${allFonts.length} font files found in public/fonts/`);
    } else {
      fail('Design', 'No font files found in public/fonts/');
    }
  }

  // Colors applied to site.config.ts
  const siteConfig = readText('src/site.config.ts');
  if (siteConfig && primary) {
    if (siteConfig.includes(primary)) {
      pass('Design', 'Primary color applied to site.config.ts');
    } else {
      warn('Design', 'Primary color from design-tokens.json not found in site.config.ts');
    }
  }
} else {
  fail('Design', 'design-tokens.json missing');
}

// ---------------------------------------------------------------------------
// CONTENT CHECKS
// ---------------------------------------------------------------------------
const siteConfig = readText('src/site.config.ts');

if (siteConfig) {
  // Count services
  const serviceMatches = siteConfig.match(/slug:\s*["'][^"']+["']/g) || [];
  const serviceCount = serviceMatches.length;
  if (serviceCount <= 6) {
    pass('Content', `${serviceCount} service pages (max 6)`);
  } else {
    fail('Content', `${serviceCount} service pages exceeds max of 6`);
  }

  // Check for pricing page
  if (/pricing/i.test(siteConfig) && /href:\s*["'][^"']*pricing/i.test(siteConfig)) {
    fail('Content', 'Pricing page detected (banned per build rules)');
  } else {
    pass('Content', 'No pricing page');
  }

  // Placeholder text check
  const placeholders = ['Your Business Name', 'PLACEHOLDER', 'TODO:', 'REPLACE_ME', 'Lorem ipsum'];
  const foundPlaceholders = placeholders.filter(p => siteConfig.includes(p));
  if (foundPlaceholders.length === 0) {
    pass('Content', 'No placeholder text in site.config.ts');
  } else {
    fail('Content', `Placeholder text found: ${foundPlaceholders.join(', ')}`);
  }

  // Reviews mapped if reviews.json has testimonials
  if (reviews && (reviews.testimonials || []).length > 0) {
    const hasReviewItems = /items:\s*\[[\s\S]*?name:/m.test(siteConfig);
    if (hasReviewItems) {
      pass('Content', 'Reviews mapped to site.config.ts');
    } else {
      warn('Content', 'reviews.json has testimonials but site.config.ts reviews.items appears empty');
    }
  }
} else {
  fail('Content', 'src/site.config.ts missing');
}

// Area pages check (from site.config.ts areas array or page files)
const areaPages = globDir('src/pages', '.astro').filter(f => {
  const name = path.basename(f, '.astro');
  return !['index', '404', 'about-us', 'contact', 'reviews', 'privacy-policy',
    'terms-and-conditions', 'thank-you', 'robots.txt'].includes(name);
});
// This is approximate — count [slug].astro as dynamic route, not area pages
// Better: check site.config.ts for areas/locations array
if (siteConfig) {
  const areasMatch = siteConfig.match(/areas:\s*\[/);
  if (areasMatch) {
    const areasSection = siteConfig.slice(siteConfig.indexOf('areas:'));
    const areaCount = (areasSection.match(/city:\s*["']/g) || []).length;
    if (areaCount <= 3) {
      pass('Content', `${areaCount} area pages (max 3)`);
    } else {
      fail('Content', `${areaCount} area pages exceeds max of 3`);
    }
  } else {
    pass('Content', '0 area pages (none defined)');
  }
}

// ---------------------------------------------------------------------------
// IMAGE CHECKS
// ---------------------------------------------------------------------------
const imagesTs = readText('src/images.ts');

if (imagesTs) {
  // Logo check (support both singular and plural folder names)
  const logoNull = /export\s+const\s+logoImage[^=]*=\s*null/.test(imagesTs);
  const logoFileExists = fileExists('src/assets/images/logos/logo.png') ||
    fileExists('src/assets/images/logos/logo.jpg') ||
    fileExists('src/assets/images/logos/logo.webp') ||
    fileExists('src/assets/images/logo/logo.png') ||
    fileExists('src/assets/images/logo/logo.jpg') ||
    fileExists('src/assets/images/logo/logo.webp');

  if (!logoNull && logoFileExists) {
    pass('Images', 'Logo downloaded and imported');
  } else if (logoFileExists && logoNull) {
    fail('Images', 'Logo file exists on disk but images.ts has logoImage = null (run populate-images.mjs)');
  } else {
    warn('Images', 'No logo available (not in Airtable)');
  }

  // Headshot check (support both singular and plural folder names)
  const headshotNull = /export\s+const\s+headshotImage[^=]*=\s*null/.test(imagesTs);
  const headshotExists = globDir('src/assets/images/headshots', '.jpg').length > 0 ||
    globDir('src/assets/images/headshots', '.png').length > 0 ||
    globDir('src/assets/images/headshot', '.jpg').length > 0 ||
    globDir('src/assets/images/headshot', '.png').length > 0;

  if (!headshotNull && headshotExists) {
    pass('Images', 'Headshot downloaded and imported');
  } else if (headshotExists && headshotNull) {
    fail('Images', 'Headshot file exists on disk but images.ts has headshotImage = null');
  } else {
    warn('Images', 'No headshot available (not in Airtable)');
  }

  // Gallery check
  const galleryFiles = [
    ...globDir('src/assets/images/gallery', '.jpg'),
    ...globDir('src/assets/images/gallery', '.png'),
    ...globDir('src/assets/images/gallery', '.webp'),
  ];
  if (galleryFiles.length > 0) {
    pass('Images', `${galleryFiles.length} gallery images downloaded`);
  } else {
    warn('Images', 'No gallery images (not in Airtable)');
  }

  // Service images check — support both old (generated/) and new (convention-based) layouts
  const generatedImages = [
    ...globDir('src/assets/images/generated', '.jpg'),
    ...globDir('src/assets/images/generated', '.png'),
    ...globDir('src/assets/images/generated', '.webp'),
  ];

  // Convention-based service images: src/assets/images/services/{slug}/{placement}/
  const servicesDir = path.join(projectPath, 'src/assets/images/services');
  const conventionImages = [];
  if (fs.existsSync(servicesDir)) {
    for (const slug of fs.readdirSync(servicesDir)) {
      const slugDir = path.join(servicesDir, slug);
      if (!fs.statSync(slugDir).isDirectory()) continue;
      for (const placement of fs.readdirSync(slugDir)) {
        const placementDir = path.join(slugDir, placement);
        if (!fs.statSync(placementDir).isDirectory()) continue;
        for (const file of fs.readdirSync(placementDir)) {
          if (/\.(jpg|jpeg|png|webp)$/i.test(file)) {
            conventionImages.push(path.join('src/assets/images/services', slug, placement, file));
          }
        }
      }
    }
  }

  // Also check brand image folders (home-hero, inner-hero, service-areas)
  for (const folder of ['home-hero', 'inner-hero', 'service-areas']) {
    const dir = path.join(projectPath, 'src/assets/images', folder);
    if (fs.existsSync(dir)) {
      for (const file of fs.readdirSync(dir)) {
        if (/\.(jpg|jpeg|png|webp)$/i.test(file)) {
          conventionImages.push(path.join('src/assets/images', folder, file));
        }
      }
    }
  }

  const allGenImages = [...generatedImages, ...conventionImages];
  const placeholderImages = allGenImages.filter(f => fileSize(f) < 1024);
  const smallImages = allGenImages.filter(f => {
    const s = fileSize(f);
    return s >= 1024 && s < 10240;
  });

  if (allGenImages.length > 0 && placeholderImages.length === 0) {
    pass('Images', `${allGenImages.length} generated images, all > 1KB (no placeholders)`);
  } else if (placeholderImages.length > 0) {
    fail('Images', `${placeholderImages.length} placeholder images (< 1KB): ${placeholderImages.map(f => path.basename(f)).join(', ')}`);
  } else {
    fail('Images', 'No generated images found');
  }

  if (smallImages.length > 0) {
    warn('Images', `${smallImages.length} images between 1-10KB (may be low quality): ${smallImages.map(f => path.basename(f)).join(', ')}`);
  }

  // Correct model check via BUILD-LOG.md
  const buildLogContent = readText('BUILD-LOG.md') || '';
  const hasNanoBanana = /nano.?banana/i.test(buildLogContent);
  const hasFluxSchnell = /flux\/schnell/i.test(buildLogContent);
  const hasWrongModel = /flux.?pro|flux.?lora|flux.?dev/i.test(buildLogContent);

  if (hasWrongModel) {
    fail('Images', 'Wrong FAL model detected in BUILD-LOG.md (expected nano-banana-pro)');
  } else if (hasNanoBanana) {
    pass('Images', 'Correct FAL model used (nano-banana-pro)');
  } else if (hasFluxSchnell) {
    warn('Images', 'BUILD-LOG.md mentions flux/schnell — expected nano-banana-pro');
  } else {
    warn('Images', 'Could not verify FAL model from BUILD-LOG.md (no model name logged)');
  }

  // images.ts imports resolve check
  const importLines = imagesTs.match(/import\s+\w+\s+from\s+['"]([^'"]+)['"]/g) || [];
  let brokenImports = 0;
  for (const line of importLines) {
    const match = line.match(/from\s+['"]([^'"]+)['"]/);
    if (match) {
      const importPath = match[1];
      const resolved = path.join(projectPath, 'src', importPath);
      if (!fs.existsSync(resolved)) {
        brokenImports++;
      }
    }
  }
  if (brokenImports === 0) {
    pass('Images', `images.ts: all ${importLines.length} imports resolve`);
  } else {
    fail('Images', `images.ts: ${brokenImports} broken imports (files missing on disk)`);
  }
} else {
  fail('Images', 'src/images.ts missing');
}

// ---------------------------------------------------------------------------
// BUILD CHECKS
// ---------------------------------------------------------------------------
if (fileExists('dist')) {
  pass('Build', 'dist/ directory exists (build succeeded)');
} else {
  fail('Build', 'dist/ directory missing (build not run or failed)');
}

if (buildState?.phases?.['phase-7']?.status === 'completed') {
  pass('Build', 'Phase 7 (build) marked completed');
} else {
  fail('Build', `Phase 7 status: ${buildState?.phases?.['phase-7']?.status || 'unknown'}`);
}

// Post-build QA from BUILD-LOG.md
const buildLogContent = readText('BUILD-LOG.md') || '';
const qaPassedMatch = buildLogContent.match(/QA.*PASSED|Post-Build.*PASSED/i);
const qaErrors = (buildLogContent.match(/❌ ERROR/g) || []).length;

if (qaPassedMatch && qaErrors === 0) {
  pass('Build', 'Post-build QA passed (0 errors)');
} else if (qaErrors > 0) {
  fail('Build', `${qaErrors} errors logged in BUILD-LOG.md`);
} else {
  warn('Build', 'Could not determine post-build QA result from BUILD-LOG.md');
}

// ---------------------------------------------------------------------------
// GENERATE CHECKLIST
// ---------------------------------------------------------------------------
const total = results.passed + results.failed + results.warned;
const passRate = total > 0 ? results.passed / total : 0;

let quality;
if (results.failed > 0) quality = 'POOR';
else if (passRate >= 0.95) quality = 'EXCELLENT';
else if (passRate >= 0.85) quality = 'GOOD';
else if (passRate >= 0.75) quality = 'FAIR';
else quality = 'POOR';

const readyForDeploy = results.failed === 0;
const companyName = buildState?.metadata?.companyName ||
  designTokens?.companyName ||
  readJSON('client-config.json')?.companyName ||
  'Unknown';

// Group checks by section
const sections = {};
for (const check of results.checks) {
  if (!sections[check.section]) sections[check.section] = [];
  sections[check.section].push(check);
}

// Build markdown
let md = `# Build Checklist: ${companyName}\n\n`;
md += `**Generated:** ${new Date().toISOString().replace('T', ' ').slice(0, 19)}\n`;
if (buildState?.buildId) md += `**Build ID:** ${buildState.buildId}\n`;
md += `\n---\n\n`;

for (const [section, checks] of Object.entries(sections)) {
  md += `## ${section}\n\n`;
  for (const check of checks) {
    const icon = check.status === 'pass' ? '[x]' :
      check.status === 'fail' ? '[ ]' : '[ ]';
    const suffix = check.status === 'warn' ? ' ⚠️' :
      check.status === 'fail' ? ' ❌' : '';
    md += `- ${icon} ${check.message}${suffix}\n`;
  }
  md += '\n';
}

// Warnings & errors summary
const issues = results.checks.filter(c => c.status !== 'pass');
if (issues.length > 0) {
  md += `## Issues\n\n`;
  for (const issue of issues) {
    const icon = issue.status === 'fail' ? '❌' : '⚠️';
    md += `- ${icon} **${issue.section}:** ${issue.message}\n`;
  }
  md += '\n';
}

// Summary
md += `---\n\n`;
md += `## Summary\n\n`;
md += `| Metric | Value |\n`;
md += `|--------|-------|\n`;
md += `| Passed | ${results.passed}/${total} |\n`;
md += `| Errors | ${results.failed} |\n`;
md += `| Warnings | ${results.warned} |\n`;
md += `| Quality | **${quality}** |\n`;
md += `| Ready for deploy | ${readyForDeploy ? 'YES' : 'NO — fix errors first'} |\n`;

// Write file
const checklistPath = path.join(projectPath, 'BUILD-CHECKLIST.md');
fs.writeFileSync(checklistPath, md, 'utf-8');

// Log to BUILD-LOG.md
log.info('build-checklist', `Checklist generated: ${results.passed}/${total} passed, ${results.failed} errors, ${results.warned} warnings — ${quality}`);

// Console output
console.log(`\nGenerating build checklist for ${companyName}...\n`);
for (const [section, checks] of Object.entries(sections)) {
  const sectionPassed = checks.filter(c => c.status === 'pass').length;
  const sectionTotal = checks.length;
  const sectionFailed = checks.filter(c => c.status === 'fail').length;
  const sectionWarned = checks.filter(c => c.status === 'warn').length;
  const sectionIcon = sectionFailed > 0 ? '✗' : sectionWarned > 0 ? '⚠' : '✓';
  const extra = [];
  if (sectionFailed > 0) extra.push(`${sectionFailed} error${sectionFailed > 1 ? 's' : ''}`);
  if (sectionWarned > 0) extra.push(`${sectionWarned} warning${sectionWarned > 1 ? 's' : ''}`);
  console.log(`${sectionIcon} ${section}: ${sectionPassed}/${sectionTotal}${extra.length ? ` (${extra.join(', ')})` : ''}`);
}

console.log(`\nBUILD-CHECKLIST.md written to project root`);
console.log(`Summary: ${results.passed}/${total} checks passed, ${results.failed} errors, ${results.warned} warnings`);
console.log(`Quality: ${quality} | Ready for deploy: ${readyForDeploy ? 'YES' : 'NO'}\n`);

// Write summary JSON for programmatic consumption
const summaryJSON = {
  passed: results.passed,
  total,
  errors: results.failed,
  warnings: results.warned,
  quality,
  readyForDeploy,
  issues: issues.map(i => ({ type: i.status === 'fail' ? 'error' : 'warning', section: i.section, message: i.message })),
};
fs.writeFileSync(
  path.join(projectPath, 'build-checklist-summary.json'),
  JSON.stringify(summaryJSON, null, 2),
  'utf-8',
);
