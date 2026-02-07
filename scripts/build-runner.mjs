#!/usr/bin/env node
// ============================================================================
// build-runner.mjs
// ============================================================================
// Node.js CLI runner that orchestrates the full website build pipeline.
// Calls Claude API only for the 3 AI-dependent phases (design, content, QA).
// Everything else runs as deterministic Node.js scripts.
//
// Usage:
//   node scripts/build-runner.mjs --company "SA Plumbing Solutions"
//   node scripts/build-runner.mjs --company "SA Plumbing" --record-id recXXXXXX
//   node scripts/build-runner.mjs --resume /path/to/project
//   node scripts/build-runner.mjs --resume /path/to/project --from phase-4
//   node scripts/build-runner.mjs --status /path/to/project
// ============================================================================

import { existsSync, readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { parseCliArgs, runScript, runCommand, slugify, validateEnvVars, printPhase } from './lib/runner-utils.mjs';
import { initBuildState, startPhase, completePhase, failPhase, printStatus, getBuildState, updateMetadata } from './lib/phase-gate.mjs';
import { buildLog } from './lib/build-logger.mjs';
import { generateDesignDirection, generateContent, analyzeQAResults } from './lib/claude-api.mjs';
import { generateMissingImages, ensureServiceImageFolders } from './lib/fal-api.mjs';
import { deployToNetlify } from './lib/deploy.mjs';
import { replaceSection, serializeToTS } from './lib/config-writer.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = __dirname;
const TEMPLATE_ROOT = resolve(__dirname, '..');
const DEFAULT_DEST = resolve(TEMPLATE_ROOT, '..');

// ---------------------------------------------------------------------------
// Build context — passed through all phases
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} BuildContext
 * @property {string|null} projectPath
 * @property {string} companyName
 * @property {string|null} recordId
 * @property {Object|null} clientConfig
 * @property {Object|null} designTokens
 * @property {Object|null} contentGenerated
 * @property {string|null} deployUrl
 * @property {string} tmpPath - Temp working directory before clone
 */

// ---------------------------------------------------------------------------
// Phase implementations
// ---------------------------------------------------------------------------

async function phase0_HealthCheck(ctx) {
  printPhase('phase-0', 'Health Check');

  // Validate environment variables
  // Note: ANTHROPIC_API_KEY not needed - we use Claude Code CLI instead
  // Note: NETLIFY_AUTH_TOKEN not needed - we use Netlify CLI (already authenticated)
  const { valid, missing } = validateEnvVars([
    'FAL_KEY',
    'AIRTABLE_TOKEN',
  ]);

  if (!valid) {
    console.log('\nMissing environment variables:');
    for (const m of missing) {
      console.log(`  - ${m}`);
    }
    throw new Error(`Missing critical env vars: ${missing.join(', ')}`);
  }

  // Check optional vars and warn
  const optionalVars = ['DATAFORSEO_LOGIN', 'DATAFORSEO_PASSWORD'];
  const missingOptional = optionalVars.filter(v => !process.env[v]);
  if (missingOptional.length > 0) {
    console.log('\n  Note: DataForSEO vars not set (reviews will be skipped)');
  }

  // Create temp working directory
  mkdirSync(ctx.tmpPath, { recursive: true });

  // Initialize build state
  const buildId = `build-${Date.now()}`;
  initBuildState(ctx.tmpPath, buildId, 'template', {
    companyName: ctx.companyName,
  });

  console.log(`\n  Build ID: ${buildId}`);
  console.log(`  Temp path: ${ctx.tmpPath}`);
  console.log('  Environment: OK');
}

async function phase1_FetchData(ctx) {
  printPhase('phase-1', 'Airtable Data Fetch');

  const outputPath = join(ctx.tmpPath, 'client-config.json');
  const args = ['--output', outputPath];

  if (ctx.recordId) {
    args.push('--record-id', ctx.recordId);
  } else {
    args.push('--company', ctx.companyName);
  }

  runScript(join(SCRIPTS_DIR, 'fetch-airtable.mjs'), args);

  // Load the fetched config
  ctx.clientConfig = JSON.parse(readFileSync(outputPath, 'utf-8'));

  // Update build state with niche
  if (ctx.clientConfig.niche) {
    updateMetadata(ctx.tmpPath, { niche: ctx.clientConfig.niche });
  }
}

async function phase1_5_Reviews(ctx) {
  printPhase('phase-1.5', 'Review Collection');

  const log = buildLog(ctx.tmpPath);

  try {
    runScript(join(SCRIPTS_DIR, 'fetch-reviews.mjs'), [
      '--project', ctx.tmpPath,
      '--data', join(ctx.tmpPath, 'client-config.json'),
    ], { timeout: 180_000 });

    log.info('build-runner', 'Reviews fetched successfully');
  } catch (err) {
    // Non-blocking — reviews are optional
    log.warning('build-runner', `Review collection failed: ${err.message}`);
    console.log(`  Warning: Review collection failed (non-blocking): ${err.message}`);

    // Create empty REVIEWS.md so downstream doesn't break
    if (!existsSync(join(ctx.tmpPath, 'REVIEWS.md'))) {
      writeFileSync(
        join(ctx.tmpPath, 'REVIEWS.md'),
        `# Reviews\n\nNo reviews found online. Review collection encountered an error.\n`,
        'utf-8'
      );
    }
  }
}

async function phase2_DesignDirection(ctx) {
  printPhase('phase-2', 'Design Direction (Claude API)');

  const designTokens = await generateDesignDirection(ctx.clientConfig);
  ctx.designTokens = designTokens;

  // Write design-tokens.json
  const tokensPath = join(ctx.tmpPath, 'design-tokens.json');
  writeFileSync(tokensPath, JSON.stringify(designTokens, null, 2), 'utf-8');

  const log = buildLog(ctx.tmpPath);
  log.info('build-runner', `Design direction: ${designTokens.direction} — ${designTokens.fonts.display}/${designTokens.fonts.body}`);
  log.info('build-runner', `Colors: primary=${designTokens.colors.primary}, accent=${designTokens.colors.accent}`);
}

async function phase3_CloneTemplate(ctx) {
  printPhase('phase-3', 'Clone Template');

  const slug = slugify(ctx.companyName);
  const projectPath = join(DEFAULT_DEST, slug);

  // Clone
  runScript(join(SCRIPTS_DIR, 'clone-template.mjs'), [
    '--name', slug,
    '--dest', DEFAULT_DEST,
  ]);

  ctx.projectPath = projectPath;

  // Copy artifacts from tmp to project
  const filesToCopy = [
    'client-config.json',
    'design-tokens.json',
    'reviews.json',
    'REVIEWS.md',
  ];

  for (const file of filesToCopy) {
    const src = join(ctx.tmpPath, file);
    if (existsSync(src)) {
      copyFileSync(src, join(projectPath, file));
      console.log(`  Copied: ${file}`);
    }
  }

  // Copy src/content/reviews.json if generated during review collection
  const srcContentReviews = join(ctx.tmpPath, 'src/content/reviews.json');
  if (existsSync(srcContentReviews)) {
    const destContentDir = join(projectPath, 'src/content');
    mkdirSync(destContentDir, { recursive: true });
    copyFileSync(srcContentReviews, join(destContentDir, 'reviews.json'));
    console.log(`  Copied: src/content/reviews.json`);
  }

  // Re-initialize build state in the actual project
  const buildId = `build-${Date.now()}`;
  initBuildState(projectPath, buildId, 'template', {
    companyName: ctx.companyName,
    niche: ctx.clientConfig?.niche || '',
  });

  // Mark phases 0-3 as completed (they're done by this point)
  completePhase(projectPath, 'phase-0');
  completePhase(projectPath, 'phase-1', { clientConfig: 'client-config.json' });
  completePhase(projectPath, 'phase-2', { designTokens: 'design-tokens.json' });

  // npm install
  console.log('\n  Running npm install...');
  runCommand('npm install', { cwd: projectPath, timeout: 180_000 });
  console.log('  npm install complete');
}

async function phase4_ContentGeneration(ctx) {
  printPhase('phase-4', 'Content Generation (Claude API)');

  const log = buildLog(ctx.projectPath);

  // Step 1: Generate content via Claude
  const content = await generateContent(ctx.clientConfig, ctx.designTokens);
  ctx.contentGenerated = content;

  // Write content JSON for reference
  writeFileSync(
    join(ctx.projectPath, 'content-generated.json'),
    JSON.stringify(content, null, 2),
    'utf-8'
  );
  log.info('build-runner', `Content generated: ${content.services.length} services, homepage, about, contact`);

  // Step 2: Run populate-config (identity + contact + design tokens)
  runScript(join(SCRIPTS_DIR, 'populate-config.mjs'), [
    '--project', ctx.projectPath,
    '--data', join(ctx.projectPath, 'client-config.json'),
    '--design', join(ctx.projectPath, 'design-tokens.json'),
  ]);

  // Step 3: Inject Claude-generated content into site.config.ts
  console.log('\n  Injecting generated content into site.config.ts...');
  const configPath = join(ctx.projectPath, 'src/site.config.ts');
  const backup = readFileSync(configPath, 'utf-8');

  try {
    const updated = injectContent(backup, content, ctx.clientConfig);
    writeFileSync(configPath, updated, 'utf-8');
    log.info('build-runner', 'Content injected into site.config.ts');
    console.log('  Content injected successfully');
  } catch (err) {
    // Restore backup on failure
    writeFileSync(configPath, backup, 'utf-8');
    throw new Error(`Content injection failed: ${err.message}`);
  }

  // Step 4: Inject reviews from reviews.json
  injectReviews(ctx.projectPath, log);

  // Step 5: Ensure service image folders exist for actual service slugs
  console.log('\n  Setting up service image folders...');
  ensureServiceImageFolders(ctx.projectPath, content.services || []);
}

async function phase4_5_Fonts(ctx) {
  printPhase('phase-4.5', 'Download Fonts');

  runScript(join(SCRIPTS_DIR, 'download-fonts.mjs'), [
    '--project', ctx.projectPath,
  ]);
}

async function phase5_ThemeLocations(ctx) {
  printPhase('phase-5', 'Theme & Locations');

  // Generate CSS theme
  runScript(join(SCRIPTS_DIR, 'generate-theme.mjs'), [
    '--project', ctx.projectPath,
  ]);

  // Generate location files
  runScript(join(SCRIPTS_DIR, 'populate-locations.mjs'), [
    '--project', ctx.projectPath,
    '--data', join(ctx.projectPath, 'client-mapped.json'),
  ]);
}

async function phase6_DownloadImages(ctx) {
  printPhase('phase-6a', 'Download Airtable Images');

  // Step 1: Download images from Airtable (before fast build)
  console.log('  Downloading Airtable images...');
  try {
    runScript(join(SCRIPTS_DIR, 'populate-images.mjs'), [
      '--project', ctx.projectPath,
      '--data', join(ctx.projectPath, 'client-config.json'),
    ]);
  } catch (err) {
    console.log(`  Warning: Image download had issues: ${err.message}`);
  }
}

async function phase7a_FastBuild(ctx) {
  printPhase('phase-7a', 'Fast Build (pre-images)');

  console.log('  Running fast build with Airtable images + placeholders...');
  runCommand('npm run build', {
    cwd: ctx.projectPath,
    timeout: 300_000,
  });
  console.log('  Fast build complete');
}

async function phase7b_FastDeploy(ctx) {
  printPhase('phase-7b', 'Fast Deploy (live URL)');

  const result = await deployToNetlify(ctx.projectPath, ctx.companyName);
  const deployUrl = typeof result === 'string' ? result : result.deployUrl;
  const repoUrl = typeof result === 'string' ? null : result.repoUrl;
  ctx.deployUrl = deployUrl;
  ctx.repoUrl = repoUrl;
  updateMetadata(ctx.projectPath, { deployUrl, ...(repoUrl ? { repoUrl } : {}) });

  const log = buildLog(ctx.projectPath);
  log.info('build-runner', `Fast deploy live: ${deployUrl} (placeholder images — FAL generation next)`);
  console.log(`\n  Live URL (pre-images): ${deployUrl}`);
}

async function phase6_GenerateImages(ctx) {
  printPhase('phase-6b', 'Generate FAL Images');

  // Generate missing images via FAL
  console.log('  Generating missing images via FAL AI...');
  await generateMissingImages(ctx);

  // No codegen needed — images.ts uses import.meta.glob() for auto-discovery
  console.log('\n  Image registry: glob-based auto-discovery (no codegen needed)');
}

async function phase7_Build(ctx) {
  printPhase('phase-7', 'Full Build (with images)');

  console.log('  Running: npm run build');
  runCommand('npm run build', {
    cwd: ctx.projectPath,
    timeout: 300_000,
  });
  console.log('  Build complete');
}

async function phase8_Deploy(ctx) {
  printPhase('phase-8', 'Deploy (final)');

  const result = await deployToNetlify(ctx.projectPath, ctx.companyName);
  const deployUrl = typeof result === 'string' ? result : result.deployUrl;
  const repoUrl = typeof result === 'string' ? null : result.repoUrl;
  ctx.deployUrl = deployUrl;
  ctx.repoUrl = repoUrl;
  updateMetadata(ctx.projectPath, { deployUrl, ...(repoUrl ? { repoUrl } : {}) });
}

async function phase9_QA(ctx) {
  printPhase('phase-9', 'QA Analysis (Claude API)');

  // Read QA output from BUILD-LOG.md
  const buildLogPath = join(ctx.projectPath, 'BUILD-LOG.md');
  const buildLogContent = existsSync(buildLogPath)
    ? readFileSync(buildLogPath, 'utf-8').slice(-3000)  // Last 3000 chars
    : 'No build log found.';

  // Read post-build QA output (if captured by postbuild hook)
  let qaOutput = '';
  const qaPath = join(ctx.projectPath, 'qa-results.txt');
  if (existsSync(qaPath)) {
    qaOutput = readFileSync(qaPath, 'utf-8');
  }

  const result = await analyzeQAResults(qaOutput, buildLogContent);
  const log = buildLog(ctx.projectPath);

  if (result.verdict === 'pass') {
    log.info('build-runner', `QA passed: ${result.summary}`);
    console.log(`\n  QA Result: PASS`);
    console.log(`  ${result.summary}`);
    return;
  }

  if (result.verdict === 'manual-review-needed') {
    log.warning('build-runner', `QA needs manual review: ${result.summary}`);
    console.log(`\n  QA Result: MANUAL REVIEW NEEDED`);
    console.log(`  ${result.summary}`);
    for (const issue of result.issues) {
      console.log(`    - ${issue.description} [${issue.action}]`);
    }
    return;
  }

  // fix-and-rebuild: apply fixes and rebuild once
  console.log(`\n  QA Result: FIX AND REBUILD`);
  console.log(`  Applying ${result.issues.filter(i => i.action === 'fix').length} fixes...`);

  let fixesApplied = 0;
  for (const issue of result.issues) {
    if (issue.action !== 'fix' || !issue.filePath || !issue.searchText || !issue.replaceText) continue;

    const fullPath = join(ctx.projectPath, issue.filePath);
    if (!existsSync(fullPath)) {
      log.warning('build-runner', `QA fix skipped — file not found: ${issue.filePath}`);
      continue;
    }

    try {
      let fileContent = readFileSync(fullPath, 'utf-8');
      if (fileContent.includes(issue.searchText)) {
        fileContent = fileContent.replace(issue.searchText, issue.replaceText);
        writeFileSync(fullPath, fileContent, 'utf-8');
        log.fix('build-runner', `QA fix applied: ${issue.fixDescription || issue.description}`);
        fixesApplied++;
      }
    } catch (err) {
      log.error('build-runner', `QA fix failed for ${issue.filePath}: ${err.message}`);
    }
  }

  if (fixesApplied > 0) {
    console.log(`  ${fixesApplied} fixes applied. Rebuilding...`);
    log.info('build-runner', `Rebuilding after ${fixesApplied} QA fixes`);

    // Re-run build + deploy (once only)
    runCommand('npm run build', { cwd: ctx.projectPath, timeout: 300_000 });
    const newUrl = await deployToNetlify(ctx.projectPath, ctx.companyName);
    ctx.deployUrl = newUrl;
    updateMetadata(ctx.projectPath, { deployUrl: newUrl });
    console.log(`  Redeployed: ${newUrl}`);
  } else {
    log.info('build-runner', 'No QA fixes were applicable');
  }
}

async function phase10_Learn(ctx) {
  printPhase('phase-10', 'Learn');

  const log = buildLog(ctx.projectPath);
  log.info('build-runner', `Build complete for ${ctx.companyName}`);
  log.info('build-runner', `Deploy URL: ${ctx.deployUrl || 'not deployed'}`);

  // Log design decision for future builds
  if (ctx.designTokens) {
    try {
      const { logDesignDecision } = await import('./lib/learning.mjs');
      logDesignDecision(
        ctx.clientConfig?.niche || 'unknown',
        ctx.designTokens.direction || 'unknown',
        ctx.designTokens.fonts || {},
        ctx.designTokens.colors || {}
      );
    } catch {
      // Non-critical
    }
  }

  // Print build log summary
  try {
    runScript(join(SCRIPTS_DIR, 'lib/build-logger.mjs'), [
      '--project', ctx.projectPath,
      '--summary',
    ]);
  } catch {
    // Non-critical
  }
}

// ---------------------------------------------------------------------------
// Content injection helpers
// ---------------------------------------------------------------------------

/**
 * Inject Claude-generated content into site.config.ts.
 * Replaces default services, homepage, about, contact, reviews, servicesPage, legal sections.
 */
function injectContent(configContent, content, clientConfig) {
  let config = configContent;

  // Standard SVG icon paths for whyChooseCards
  const iconPaths = [
    'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',                           // clock
    'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',  // shield
    'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z',  // pin
    'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',  // phone
    'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',  // star
    'M13 10V3L4 14h7v7l9-11h-7z',  // lightning
  ];

  // Add icons to whyChooseCards
  if (content.homepage?.whyChooseCards) {
    content.homepage.whyChooseCards.forEach((card, i) => {
      card.icon = iconPaths[i % iconPaths.length];
    });
  }

  // Replace each section using the section replacement strategy
  config = replaceSection(config, 'services', content.services);
  config = replaceSection(config, 'homepage', {
    title: 'Home',
    ...content.homepage,
  });
  config = replaceSection(config, 'about', content.about);
  config = replaceSection(config, 'contact', {
    ...content.contact,
    hours: {
      standard: { label: 'Standard Hours', days: 'Monday – Saturday', hours: '7:00 AM – 6:00 PM' },
      emergency: { label: 'Emergency Service', days: 'Available Every Day', hours: '24/7 — Call Anytime' },
    },
  });
  config = replaceSection(config, 'reviews', {
    ...content.reviews,
    averageRating: 5,
    totalReviews: 0,
    items: [],
  });
  config = replaceSection(config, 'servicesPage', content.servicesPage);
  config = replaceSection(config, 'legal', {
    registrations: ['Fully registered and accredited'],
    ...content.legal,
  });

  // Replace whatsappMessage
  if (content.whatsappMessage) {
    config = config.replace(
      /whatsappMessage:\s*["'][^"']*["']/,
      `whatsappMessage: ${JSON.stringify(content.whatsappMessage)}`
    );
  }

  // Update nav with service slugs
  // Note: No /areas/ page exists — location pages live at /{slug} (root level).
  // Location pages are linked from within page content, not the main nav.
  const navEntries = [
    { label: 'Home', href: '/' },
    { label: 'Services', href: '/services/' },
    ...content.services.slice(0, 4).map(s => ({
      label: s.title, href: `/services/${s.slug}/`,
    })),
    { label: 'About Us', href: '/about-us/' },
    { label: 'Reviews', href: '/reviews/' },
    { label: 'Contact', href: '/contact/' },
  ];
  config = replaceSection(config, 'nav', navEntries);

  return config;
}

// replaceSection and serializeToTS imported from ./lib/config-writer.mjs

/**
 * Inject reviews from reviews.json into site.config.ts reviews.items
 */
function injectReviews(projectPath, log) {
  const reviewsPath = join(projectPath, 'reviews.json');
  if (!existsSync(reviewsPath)) {
    log.skip('build-runner', 'No reviews.json found — skipping review injection');
    return;
  }

  try {
    const reviews = JSON.parse(readFileSync(reviewsPath, 'utf-8'));
    const configPath = join(projectPath, 'src/site.config.ts');
    let config = readFileSync(configPath, 'utf-8');

    // Update aggregate rating
    if (reviews.aggregateRating?.combined) {
      config = config.replace(
        /averageRating:\s*\d+\.?\d*/,
        `averageRating: ${reviews.aggregateRating.combined}`
      );
    }
    if (reviews.reviewCounts?.total) {
      config = config.replace(
        /totalReviews:\s*\d+/,
        `totalReviews: ${reviews.reviewCounts.total}`
      );
    }

    // Inject testimonials as items
    if (reviews.testimonials?.length > 0) {
      // SiteConfig interface uses: name, text, rating, date?, service?, source?
      const items = reviews.testimonials.slice(0, 6).map(t => ({
        name: t.author || 'Customer',
        text: (t.quote || '').slice(0, 300),
        rating: t.rating || 5,
        source: t.platform || 'google',
        date: t.date || undefined,
      }));
      const serialized = serializeToTS(items, 4);
      config = config.replace(/items:\s*\[\]/, `items: ${serialized}`);
    }

    writeFileSync(configPath, config, 'utf-8');
    log.info('build-runner', `Reviews injected: rating=${reviews.aggregateRating?.combined || 'N/A'}, count=${reviews.reviewCounts?.total || 0}, testimonials=${reviews.testimonials?.length || 0}`);
    console.log('  Reviews injected into site.config.ts');

    // Also create src/content/reviews.json for schema.org components.
    // This must happen here (not in fetch-reviews.mjs) because during phase 1.5
    // the project hasn't been cloned yet — tmpPath has no src/content/ directory.
    const contentDir = join(projectPath, 'src/content');
    if (existsSync(contentDir)) {
      const contentReviews = (reviews.testimonials || []).map(t => ({
        name: t.author || 'Customer',
        text: (t.quote || '').slice(0, 300),
        rating: t.rating || 5,
        date: t.date || new Date().toISOString().split('T')[0],
        source: t.platform || 'google',
      }));
      writeFileSync(
        join(contentDir, 'reviews.json'),
        JSON.stringify(contentReviews, null, 2),
        'utf-8'
      );
      log.info('build-runner', `src/content/reviews.json created (${contentReviews.length} reviews)`);
      console.log(`  src/content/reviews.json created (${contentReviews.length} reviews)`);
    }
  } catch (err) {
    log.warning('build-runner', `Review injection failed: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Resume logic
// ---------------------------------------------------------------------------

function determineResumePoint(projectPath, fromPhase) {
  if (fromPhase) return fromPhase;

  const result = getBuildState(projectPath);
  if (!result.exists || !result.valid) {
    throw new Error(`Cannot resume: ${result.error}`);
  }

  const { state } = result;
  const phaseOrder = [
    'phase-0', 'phase-1', 'phase-2', 'phase-3',
    'phase-4', 'phase-5', 'phase-7a', 'phase-7b',
    'phase-6', 'phase-7', 'phase-8', 'phase-9', 'phase-10',
  ];

  // Find first non-completed phase
  for (const id of phaseOrder) {
    const phase = state.phases[id];
    if (!phase || phase.status !== 'completed') {
      return id;
    }
  }

  return 'phase-10'; // All done
}

function loadContextFromProject(projectPath, ctx) {
  // Load existing artifacts from a resumed project
  const configPath = join(projectPath, 'client-config.json');
  if (existsSync(configPath)) {
    ctx.clientConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
    ctx.companyName = ctx.clientConfig.companyName || ctx.companyName;
  }

  const designPath = join(projectPath, 'design-tokens.json');
  if (existsSync(designPath)) {
    ctx.designTokens = JSON.parse(readFileSync(designPath, 'utf-8'));
  }

  const contentPath = join(projectPath, 'content-generated.json');
  if (existsSync(contentPath)) {
    ctx.contentGenerated = JSON.parse(readFileSync(contentPath, 'utf-8'));
  }

  ctx.projectPath = projectPath;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseCliArgs();

  // Status check mode
  if (args.status) {
    printStatus(resolve(args.status));
    return;
  }

  // Validate input
  if (!args.company && !args.resume) {
    console.log('Usage:');
    console.log('  node scripts/build-runner.mjs --company "SA Plumbing Solutions"');
    console.log('  node scripts/build-runner.mjs --company "Name" --record-id recXXXXXX');
    console.log('  node scripts/build-runner.mjs --resume /path/to/project');
    console.log('  node scripts/build-runner.mjs --resume /path/to/project --from phase-4');
    console.log('  node scripts/build-runner.mjs --status /path/to/project');
    process.exit(1);
  }

  // Build context
  const ctx = {
    projectPath: null,
    companyName: args.company || '',
    recordId: args['record-id'] || null,
    clientConfig: null,
    designTokens: null,
    contentGenerated: null,
    deployUrl: null,
    tmpPath: join(DEFAULT_DEST, `.tmp-build-${Date.now()}`),
  };

  // Phase definitions
  // Sub-phases (1.5, 4.5) are treated as part of their parent for phase-gate
  // Progressive deploy: 6a → 7a → 7b (live URL fast) → 6b → 7 → 8 (final)
  const phases = [
    { id: 'phase-0',   gateId: 'phase-0',  label: 'Health Check',              fn: phase0_HealthCheck },
    { id: 'phase-1',   gateId: 'phase-1',  label: 'Airtable Data Fetch',       fn: phase1_FetchData },
    { id: 'phase-1.5', gateId: null,        label: 'Review Collection',         fn: phase1_5_Reviews },
    { id: 'phase-2',   gateId: 'phase-2',  label: 'Design Direction',          fn: phase2_DesignDirection },
    { id: 'phase-3',   gateId: 'phase-3',  label: 'Clone Template',            fn: phase3_CloneTemplate },
    { id: 'phase-4',   gateId: 'phase-4',  label: 'Content Generation',        fn: phase4_ContentGeneration },
    { id: 'phase-4.5', gateId: null,        label: 'Download Fonts',            fn: phase4_5_Fonts },
    { id: 'phase-5',   gateId: 'phase-5',  label: 'Theme & Locations',         fn: phase5_ThemeLocations },
    { id: 'phase-6a',  gateId: null,        label: 'Download Airtable Images',  fn: phase6_DownloadImages },
    { id: 'phase-7a',  gateId: 'phase-7a', label: 'Fast Build',                fn: phase7a_FastBuild },
    { id: 'phase-7b',  gateId: 'phase-7b', label: 'Fast Deploy',               fn: phase7b_FastDeploy },
    { id: 'phase-6b',  gateId: 'phase-6',  label: 'Generate FAL Images',       fn: phase6_GenerateImages },
    { id: 'phase-7',   gateId: 'phase-7',  label: 'Full Build',                fn: phase7_Build },
    { id: 'phase-8',   gateId: 'phase-8',  label: 'Deploy (final)',            fn: phase8_Deploy },
    { id: 'phase-9',   gateId: 'phase-9',  label: 'QA Analysis',               fn: phase9_QA },
    { id: 'phase-10',  gateId: 'phase-10', label: 'Learn',                     fn: phase10_Learn },
  ];

  // Determine start point
  let startId = 'phase-0';
  if (args.resume) {
    const resumePath = resolve(args.resume);
    if (!existsSync(resumePath)) {
      console.error(`Resume path not found: ${resumePath}`);
      process.exit(1);
    }
    loadContextFromProject(resumePath, ctx);
    startId = determineResumePoint(resumePath, args.from || null);
    console.log(`\nResuming build from ${startId} at ${resumePath}`);
  }

  const startIdx = phases.findIndex(p => p.id === startId);
  if (startIdx === -1) {
    console.error(`Unknown phase: ${startId}`);
    process.exit(1);
  }

  // Print banner
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║              BUILD RUNNER — Local Service Site            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`  Company: ${ctx.companyName}`);
  console.log(`  Start:   ${startId}`);
  console.log(`  Time:    ${new Date().toISOString()}`);

  const startTime = Date.now();

  // Execute phases
  for (let i = startIdx; i < phases.length; i++) {
    const phase = phases[i];
    const targetPath = ctx.projectPath || ctx.tmpPath;

    // Mark phase as started in build-state
    if (phase.gateId && existsSync(join(targetPath, 'build-state.json'))) {
      try { startPhase(targetPath, phase.gateId); } catch { /* ignore if gate doesn't exist yet */ }
    }

    try {
      await phase.fn(ctx);

      // Mark phase as completed
      if (phase.gateId && ctx.projectPath && existsSync(join(ctx.projectPath, 'build-state.json'))) {
        try { completePhase(ctx.projectPath, phase.gateId); } catch { /* ignore */ }
      }
    } catch (err) {
      // Mark phase as failed
      const failPath = ctx.projectPath || ctx.tmpPath;
      if (phase.gateId && existsSync(join(failPath, 'build-state.json'))) {
        try { failPhase(failPath, phase.gateId, err.message); } catch { /* ignore */ }
      }

      console.error(`\n${'='.repeat(60)}`);
      console.error(`  BUILD FAILED at ${phase.id}: ${phase.label}`);
      console.error(`  Error: ${err.message}`);
      console.error(`${'='.repeat(60)}`);

      // macOS desktop notification
      try {
        execSync(`osascript -e 'display notification "Failed at ${phase.id}: ${phase.label}" with title "Build Failed" subtitle "${ctx.companyName}" sound name "Basso"'`);
      } catch { /* non-critical */ }

      if (ctx.projectPath) {
        console.error(`\n  Resume with:`);
        console.error(`  node scripts/build-runner.mjs --resume ${ctx.projectPath}`);
      }
      process.exit(1);
    }
  }

  // Done!
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log(`\n╔════════════════════════════════════════════════════════════╗`);
  console.log(`║                    BUILD COMPLETE                         ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝`);
  console.log(`  Company:  ${ctx.companyName}`);
  console.log(`  Project:  ${ctx.projectPath}`);
  console.log(`  URL:      ${ctx.deployUrl || 'not deployed'}`);
  console.log(`  Duration: ${elapsed}s`);
  console.log('');

  // macOS desktop notification on success
  try {
    execSync(`osascript -e 'display notification "${ctx.deployUrl || 'Build complete'}" with title "Build Complete" subtitle "${ctx.companyName} (${elapsed}s)" sound name "Glass"'`);
  } catch { /* non-critical */ }
}

main().catch(err => {
  console.error(`\nFatal error: ${err.message}`);
  process.exit(1);
});
