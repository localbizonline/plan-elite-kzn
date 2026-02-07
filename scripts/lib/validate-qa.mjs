#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { SeoQaResult, DesignReviewResult, ImageQaResult, ScreenshotManifest } from '../schemas/qa-results.schema.mjs';
import { buildLog } from './build-logger.mjs';

// ============================================================================
// validate-qa.mjs
// ============================================================================
// Hard gate script for Phase 9 completion. Validates that ALL 3 QA agents
// ran and produced valid output. Merges results into qa-results.json.
// Must exit 0 before phase-9 can be marked complete.
//
// Usage:
//   node scripts/lib/validate-qa.mjs --project /path
//
// Exit code: 0 = all valid, 1 = missing/invalid results
// ============================================================================

const REQUIRED_RESULTS = [
  { file: 'seo-qa-results.json', agent: 'seo-qa', label: 'SEO QA (Phase 9a)', schema: SeoQaResult },
  { file: 'design-review.json', agent: 'design-reviewer', label: 'Design Review (Phase 9b)', schema: DesignReviewResult },
  { file: 'image-qa-results.json', agent: 'image-qa', label: 'Image QA (Phase 9c)', schema: ImageQaResult },
];

/**
 * Validate a single QA result file
 * @param {string} projectPath
 * @param {string} filename
 * @param {import('zod').ZodType} schema
 * @returns {{ valid: boolean, errors: string[], data: object|null }}
 */
function validateResultFile(projectPath, filename, schema) {
  const filePath = path.join(projectPath, filename);
  const errors = [];

  if (!fs.existsSync(filePath)) {
    return { valid: false, errors: [`${filename} does not exist — agent did not run`], data: null };
  }

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    return { valid: false, errors: [`${filename} is invalid JSON: ${e.message}`], data: null };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    errors.push(`${filename} schema validation failed:\n${issues}`);
    return { valid: false, errors, data: raw };
  }

  return { valid: true, errors: [], data: result.data };
}

/**
 * Validate the screenshot manifest
 * @param {string} projectPath
 * @returns {{ valid: boolean, errors: string[], warnings: string[], captured: number }}
 */
function validateScreenshots(projectPath) {
  const manifestPath = path.join(projectPath, 'qa-screenshots', 'manifest.json');
  const errors = [];
  const warnings = [];

  if (!fs.existsSync(manifestPath)) {
    return {
      valid: false,
      errors: ['qa-screenshots/manifest.json does not exist — design-reviewer did not capture screenshots'],
      warnings: [],
      captured: 0,
    };
  }

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  } catch (e) {
    return { valid: false, errors: [`qa-screenshots/manifest.json invalid JSON: ${e.message}`], warnings: [], captured: 0 };
  }

  const result = ScreenshotManifest.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    return { valid: false, errors: [`Screenshot manifest schema failed:\n${issues}`], warnings: [], captured: 0 };
  }

  const manifest = result.data;
  const successful = manifest.screenshots.filter(s => s.status === 'ok');
  const failed = manifest.screenshots.filter(s => s.status === 'error');

  if (successful.length === 0) {
    errors.push('No successful screenshots in manifest');
  }

  if (failed.length > 0) {
    warnings.push(`${failed.length} screenshot(s) failed: ${failed.map(f => f.route).join(', ')}`);
  }

  // Verify actual PNG files exist on disk
  for (const entry of successful) {
    if (entry.desktop && !fs.existsSync(entry.desktop)) {
      errors.push(`Desktop screenshot missing on disk: ${entry.desktop}`);
    }
    if (entry.mobile && !fs.existsSync(entry.mobile)) {
      errors.push(`Mobile screenshot missing on disk: ${entry.mobile}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    captured: successful.length,
  };
}

/**
 * Main validation — checks all 3 results + screenshots, merges into qa-results.json
 * @param {string} projectPath
 * @returns {{ valid: boolean, errors: string[], warnings: string[], merged: object|null }}
 */
export function validateQaResults(projectPath) {
  const allErrors = [];
  const allWarnings = [];
  const agentData = {};

  console.log('Validating Phase 9 QA results...\n');

  // Validate each agent's result file
  for (const { file, agent, label, schema } of REQUIRED_RESULTS) {
    const result = validateResultFile(projectPath, file, schema);
    if (result.valid) {
      console.log(`  ✓ ${label}: valid`);
      agentData[agent] = result.data;
    } else {
      console.log(`  ✗ ${label}: INVALID`);
      for (const e of result.errors) console.log(`    ${e}`);
      allErrors.push(...result.errors);
    }
  }

  // Validate screenshots
  const screenshots = validateScreenshots(projectPath);
  if (screenshots.valid) {
    console.log(`  ✓ Screenshots: ${screenshots.captured} pages captured`);
  } else {
    console.log(`  ✗ Screenshots: INVALID`);
    for (const e of screenshots.errors) console.log(`    ${e}`);
    allErrors.push(...screenshots.errors);
  }
  allWarnings.push(...screenshots.warnings);

  if (allErrors.length > 0) {
    return { valid: false, errors: allErrors, warnings: allWarnings, merged: null };
  }

  // All valid — merge into qa-results.json
  const seo = agentData['seo-qa'];
  const design = agentData['design-reviewer'];
  const image = agentData['image-qa'];

  const seoErrors = seo.summary?.errors ?? seo.failures?.length ?? 0;
  const seoWarnings = seo.summary?.warnings ?? seo.warnings?.length ?? 0;
  const designErrors = design.summary?.errors ?? design.errors?.length ?? 0;
  const designWarnings = design.summary?.warnings ?? design.warnings?.length ?? 0;
  const imageErrors = image.summary?.errors ?? image.errors?.length ?? 0;
  const imageWarnings = image.summary?.warnings ?? image.warnings?.length ?? 0;

  const totalErrors = seoErrors + designErrors + imageErrors;
  const totalWarnings = seoWarnings + designWarnings + imageWarnings;

  // Collect all failure descriptions
  const allFailures = [];
  if (seo.failures) {
    for (const f of seo.failures) allFailures.push(`[seo] ${f.page || ''} ${f.check}: ${f.detail}`);
  }
  if (design.errors) {
    for (const e of design.errors) allFailures.push(`[design] ${e.page} ${e.issue}: ${e.detail}`);
  }
  if (image.errors) {
    for (const e of image.errors) allFailures.push(`[image] ${e.check}: ${e.detail}`);
  }

  const merged = {
    timestamp: new Date().toISOString(),
    deployUrl: seo.deployUrl || design.deployUrl,
    attempt: Math.max(seo.attempt || 1, design.attempt || 1, image.attempt || 1),
    agents: {
      'seo-qa': { status: seo.passed ? 'pass' : 'fail', errors: seoErrors, warnings: seoWarnings },
      'design-reviewer': { status: design.passed ? 'pass' : 'fail', errors: designErrors, warnings: designWarnings },
      'image-qa': { status: image.passed ? 'pass' : 'fail', errors: imageErrors, warnings: imageWarnings },
    },
    passed: seo.passed && design.passed && image.passed,
    totalErrors,
    totalWarnings,
    allFailures,
    screenshotsCaptured: screenshots.captured,
  };

  // Write merged results
  const mergedPath = path.join(projectPath, 'qa-results.json');
  fs.writeFileSync(mergedPath, JSON.stringify(merged, null, 2));

  console.log(`\n  Merged → qa-results.json`);
  console.log(`  Total: ${totalErrors} errors, ${totalWarnings} warnings`);
  console.log(`  Overall: ${merged.passed ? 'PASSED' : 'FAILED'}`);

  return { valid: true, errors: [], warnings: allWarnings, merged };
}

// --- CLI ---

const isDirectExecution = process.argv[1]?.endsWith('validate-qa.mjs');
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
  const log = buildLog(projectPath);

  console.log(`\nQA Validation Gate — ${projectPath}\n`);

  const result = validateQaResults(projectPath);

  if (result.valid) {
    log.info('validate-qa', `QA validation passed: all 3 agents ran, ${result.merged.totalErrors} total errors, ${result.merged.totalWarnings} warnings`);
    console.log('\nVALIDATION PASSED — phase-9 can be completed');
    process.exit(0);
  } else {
    log.error('validate-qa', `QA validation FAILED: ${result.errors.length} issues — ${result.errors.join('; ')}`);
    console.log(`\nVALIDATION FAILED — ${result.errors.length} issue(s):`);
    for (const e of result.errors) console.log(`  ✗ ${e}`);
    console.log('\nphase-9 CANNOT be completed until all QA agents run successfully.');
    process.exit(1);
  }
}
