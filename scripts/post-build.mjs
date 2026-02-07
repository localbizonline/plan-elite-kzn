/**
 * POSTBUILD HOOK — runs after `npm run build`
 *
 * Runs static QA on dist/ output and marks phase-7 as completed.
 */
import { completePhase, failPhase } from './lib/phase-gate.mjs';
import { runStaticQA, checkBannedImports } from './lib/qa.mjs';
import { buildLog } from './lib/build-logger.mjs';

const args = process.argv.slice(2);
let projectPath = process.cwd();
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--project' && args[i + 1]) { projectPath = args[i + 1]; i++; }
}

console.log('\n═══ Post-Build QA ═══\n');

const log = buildLog(projectPath);
const qa = runStaticQA(projectPath);
const imports = checkBannedImports(projectPath);

// Log all errors to BUILD-LOG.md
for (const e of qa.errors) {
  log.error('post-build-qa', e);
}
for (const e of imports.errors) {
  log.error('post-build-qa', `Banned import: ${e}`);
}
for (const w of qa.warnings) {
  log.warning('post-build-qa', w);
}

// Report errors
if (qa.errors.length > 0) {
  console.error('ERRORS:');
  for (const e of qa.errors) console.error(`  ✗ ${e}`);
}
if (imports.errors.length > 0) {
  console.error('\nBANNED IMPORTS:');
  for (const e of imports.errors) console.error(`  ✗ ${e}`);
}

// Report warnings
if (qa.warnings.length > 0) {
  console.log('\nWARNINGS:');
  for (const w of qa.warnings) console.log(`  ⚠ ${w}`);
}

// Summary
console.log(`\nPages checked: ${qa.stats.pagesChecked}`);
console.log(`Errors: ${qa.stats.errorCount + imports.errors.length}`);
console.log(`Warnings: ${qa.stats.warningCount}`);

const allPassed = qa.passed && imports.passed;
log.info('post-build-qa', `QA result: ${allPassed ? 'PASSED' : 'FAILED'} (${qa.stats.pagesChecked} pages, ${qa.stats.errorCount + imports.errors.length} errors, ${qa.stats.warningCount} warnings)`);

// Append summary section to build log
log.section('Post-Build QA Summary', [
  `- **Pages checked:** ${qa.stats.pagesChecked}`,
  `- **Errors:** ${qa.stats.errorCount + imports.errors.length}`,
  `- **Warnings:** ${qa.stats.warningCount}`,
  `- **Result:** ${allPassed ? 'PASSED' : 'FAILED'}`,
].join('\n'));

// Update build state
try {
  if (allPassed) {
    completePhase(projectPath, 'phase-7', { dist: 'dist/' });
    console.log('\n✓ Phase 7 (Build) marked complete');
  } else {
    failPhase(projectPath, 'phase-7', `QA found ${qa.stats.errorCount + imports.errors.length} errors`);
    console.error('\n✗ Phase 7 (Build) marked failed — fix errors and rebuild');
  }
} catch (e) {
  // build-state.json might not exist if running standalone
  console.log(`(Could not update build state: ${e.message})`);
}

if (!allPassed) {
  console.error('\nPost-build QA FAILED');
  process.exit(1);
}

console.log('\n✓ Post-build QA PASSED\n');
process.exit(0);
