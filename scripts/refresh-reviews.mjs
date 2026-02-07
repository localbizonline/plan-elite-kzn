#!/usr/bin/env node
// ============================================================================
// refresh-reviews.mjs
// ============================================================================
// Fetches the latest Google/Hello Peter reviews and updates the site's
// reviews section in site.config.ts via the idempotent config writer.
// Then rebuilds and pushes to GitHub (Netlify auto-redeploys).
//
// Usage:
//   node scripts/refresh-reviews.mjs --project /path/to/project
//   node scripts/refresh-reviews.mjs --project /path/to/project --dry-run
//
// Can be run manually or as a monthly cron job.
// ============================================================================

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { replaceSection, replaceNumericValue, readConfig, writeConfig, serializeToTS } from './lib/config-writer.mjs';
import { buildLog } from './lib/build-logger.mjs';
import { runScript, runCommand, parseCliArgs } from './lib/runner-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const args = parseCliArgs();
  const projectPath = args.project ? resolve(args.project) : null;
  const dryRun = args['dry-run'] === true;

  if (!projectPath) {
    console.error('Usage: node scripts/refresh-reviews.mjs --project /path/to/project [--dry-run]');
    process.exit(1);
  }

  if (!existsSync(projectPath)) {
    console.error(`Project not found: ${projectPath}`);
    process.exit(1);
  }

  const log = buildLog(projectPath);

  // Step 1: Fetch fresh reviews
  console.log('Fetching latest reviews...');
  try {
    runScript(join(__dirname, 'fetch-reviews.mjs'), [
      '--project', projectPath,
      '--data', join(projectPath, 'client-config.json'),
    ], { timeout: 180_000 });
  } catch (err) {
    console.error(`Review fetch failed: ${err.message}`);
    log.error('refresh-reviews', `Review fetch failed: ${err.message}`);
    process.exit(1);
  }

  // Step 2: Read fetched reviews
  const reviewsPath = join(projectPath, 'reviews.json');
  if (!existsSync(reviewsPath)) {
    console.log('No reviews.json generated — nothing to update.');
    process.exit(0);
  }

  const reviews = JSON.parse(readFileSync(reviewsPath, 'utf-8'));
  const testimonials = reviews.testimonials || [];
  const rating = reviews.aggregateRating?.combined || 5;
  const totalCount = reviews.reviewCounts?.total || 0;

  console.log(`  Found ${testimonials.length} testimonials, rating ${rating}, total ${totalCount}`);

  if (dryRun) {
    console.log('\n--dry-run: No changes applied.');
    process.exit(0);
  }

  // Step 3: Update site.config.ts
  console.log('\nUpdating site.config.ts reviews section...');
  let config = readConfig(projectPath);

  // Update aggregate rating and count
  config = replaceNumericValue(config, 'averageRating', rating);
  config = replaceNumericValue(config, 'totalReviews', totalCount);

  // Update review items
  if (testimonials.length > 0) {
    const items = testimonials.slice(0, 6).map(t => ({
      name: t.author || 'Customer',
      text: (t.quote || '').slice(0, 300),
      rating: t.rating || 5,
      source: t.platform || 'google',
      date: t.date || undefined,
    }));
    const serialized = serializeToTS(items, 4);
    // Replace existing items array (even if populated)
    config = config.replace(/items:\s*\[[\s\S]*?\n    \]/, `items: ${serialized}`);
  }

  writeConfig(projectPath, config);
  console.log('  Reviews updated in site.config.ts');

  // Also update src/content/reviews.json for schema.org
  const contentDir = join(projectPath, 'src/content');
  if (existsSync(contentDir)) {
    const contentReviews = testimonials.map(t => ({
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
    console.log(`  src/content/reviews.json updated (${contentReviews.length} reviews)`);
  }

  log.info('refresh-reviews', `Reviews refreshed: ${testimonials.length} testimonials, rating=${rating}, total=${totalCount}`);

  // Step 4: Rebuild
  console.log('\nRebuilding...');
  runCommand('npm run build', { cwd: projectPath, timeout: 300_000 });

  // Step 5: Push to GitHub
  console.log('\nPushing to GitHub...');
  try {
    runCommand('git add -A && git commit -m "reviews: refresh from Google/Hello Peter" && git push', {
      cwd: projectPath,
      timeout: 60_000,
    });
    console.log('  Pushed — Netlify will auto-redeploy');
  } catch (err) {
    console.log(`  Git push failed (may need manual push): ${err.message}`);
  }

  log.info('refresh-reviews', 'Review refresh complete — site rebuilt and pushed');
  console.log('\nReview refresh complete.');
}

main().catch(err => {
  console.error(`Review refresh failed: ${err.message}`);
  process.exit(1);
});
