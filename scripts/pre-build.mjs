/**
 * PRE-PIPELINE HEALTH CHECK
 *
 * Run before starting a build pipeline. Validates environment and optionally
 * initializes build-state.json.
 *
 * Usage:
 *   node scripts/pre-build.mjs --project /path/to/project
 *   node scripts/pre-build.mjs --project /path/to/project --init --builder template --company "Name" --niche "Niche"
 */
import { runHealthChecks } from './lib/health-check.mjs';
import { initBuildState, completePhase } from './lib/phase-gate.mjs';

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

console.log('\n═══ Pre-Pipeline Health Check ═══\n');

// Run health checks
const health = runHealthChecks(projectPath);

for (const c of health.checks) {
  const icon = c.passed ? '✓' : '✗';
  console.log(`  ${icon} ${c.name}${c.error ? ` — ${c.error}` : ''}`);
}

if (!health.passed) {
  console.error('\n✗ Health check FAILED — fix critical issues before proceeding.');
  process.exit(1);
}

if (health.warnings.length > 0) {
  console.log(`\n  Warnings: ${health.warnings.length} (non-critical, build can proceed)`);
}

console.log('\n✓ Health check passed.');

// Initialize build state if requested
if (flags.init) {
  const buildId = flags['build-id'] || `build-${Date.now()}`;
  const builderType = flags.builder || 'template';
  const metadata = {};
  if (flags.company) metadata.companyName = flags.company;
  if (flags.niche) metadata.niche = flags.niche;

  initBuildState(projectPath, buildId, builderType, metadata);
  completePhase(projectPath, 'phase-0', {});
  console.log(`\n✓ Build state initialized: ${buildId} (${builderType})`);
  console.log('✓ Phase 0 (Health Check) marked complete');
}

console.log('');
process.exit(0);
