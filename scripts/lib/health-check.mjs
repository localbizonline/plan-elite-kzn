import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

// Derive template root from this file's location: scripts/lib/health-check.mjs → ../../
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = path.resolve(__dirname, '..', '..');

function check(name, fn) {
  try {
    fn();
    return { name, passed: true };
  } catch (e) {
    return { name, passed: false, error: e.message };
  }
}

export function runHealthChecks(projectPath) {
  const checks = [];

  checks.push(check('Node.js >= 18', () => {
    const major = parseInt(process.versions.node.split('.')[0], 10);
    if (major < 18) throw new Error(`Node ${process.versions.node} — need 18+`);
  }));

  checks.push(check('FAL_KEY environment variable', () => {
    if (!process.env.FAL_KEY) throw new Error('FAL_KEY not set');
  }));

  checks.push(check('Template directory exists', () => {
    if (!fs.existsSync(TEMPLATE_DIR)) throw new Error(`Template not found: ${TEMPLATE_DIR}`);
  }));

  checks.push(check('Project path writable', () => {
    const parent = path.dirname(projectPath);
    if (!fs.existsSync(parent)) throw new Error(`Parent directory does not exist: ${parent}`);
    fs.accessSync(parent, fs.constants.W_OK);
  }));

  checks.push(check('GitHub CLI (gh) available', () => {
    try {
      execSync('gh --version', { stdio: 'pipe', timeout: 15000 });
    } catch {
      throw new Error('gh CLI not available — install from https://cli.github.com and run `gh auth login`');
    }
  }));

  checks.push(check('Netlify CLI available', () => {
    try {
      execSync('npx netlify-cli --version', { stdio: 'pipe', timeout: 15000 });
    } catch {
      throw new Error('netlify-cli not available (npx netlify-cli --version failed)');
    }
  }));

  const passed = checks.every((c) => c.passed);
  const critical = checks.filter((c) => !c.passed && ['Node.js >= 18', 'Template directory exists'].includes(c.name));

  return {
    passed: critical.length === 0,
    allPassed: passed,
    checks,
    critical,
    warnings: checks.filter((c) => !c.passed && !critical.includes(c)),
  };
}

// CLI
const args = process.argv.slice(2);
if (args.length > 0) {
  let projectPath = process.cwd();
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--project' && args[i + 1]) projectPath = args[i + 1];
  }

  const result = runHealthChecks(projectPath);

  console.log('\nHealth Check Results:');
  for (const c of result.checks) {
    const icon = c.passed ? '✓' : '✗';
    console.log(`  ${icon} ${c.name}${c.error ? ` — ${c.error}` : ''}`);
  }

  if (result.warnings.length > 0) {
    console.log(`\nWarnings: ${result.warnings.length} (non-critical)`);
  }

  if (!result.passed) {
    console.error('\nHealth check FAILED (critical issues found)');
    process.exit(1);
  }

  console.log('\nHealth check passed.');
  process.exit(0);
}
