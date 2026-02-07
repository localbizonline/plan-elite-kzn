import fs from 'node:fs';
import path from 'node:path';
import { getBuildState } from './phase-gate.mjs';

const KNOWLEDGE_BASE = path.join(process.env.HOME || '', '.claude', 'knowledge');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/** Log a completed build to the knowledge base */
export function logBuild(projectPath, status, qaResults = null) {
  const result = getBuildState(projectPath);
  if (!result.exists || !result.valid) {
    console.error('Cannot log build — no valid build state');
    return;
  }

  const state = result.state;
  const buildsDir = path.join(KNOWLEDGE_BASE, 'builds');
  ensureDir(buildsDir);

  const log = {
    buildId: state.buildId,
    builderType: state.builderType,
    companyName: state.metadata.companyName || 'unknown',
    niche: state.metadata.niche || 'unknown',
    startedAt: state.startedAt,
    completedAt: new Date().toISOString(),
    status,
    phases: state.phases,
    qaResults: qaResults || null,
    deployUrl: state.metadata.deployUrl || null,
    repoUrl: state.metadata.repoUrl || null,
  };

  const logFile = path.join(buildsDir, `${state.buildId}.json`);
  fs.writeFileSync(logFile, JSON.stringify(log, null, 2));
  console.log(`Build logged: ${logFile}`);
  return logFile;
}

/** Log an error pattern for future self-fixing */
export function logError(error, context = {}) {
  const errorsDir = path.join(KNOWLEDGE_BASE, 'errors');
  ensureDir(errorsDir);

  const patternsFile = path.join(errorsDir, 'error-patterns.json');
  let patterns = [];
  if (fs.existsSync(patternsFile)) {
    try { patterns = JSON.parse(fs.readFileSync(patternsFile, 'utf-8')); } catch { patterns = []; }
  }

  patterns.push({
    timestamp: new Date().toISOString(),
    error: typeof error === 'string' ? error : error.message,
    context,
  });

  // Keep last 100 patterns
  if (patterns.length > 100) patterns = patterns.slice(-100);

  fs.writeFileSync(patternsFile, JSON.stringify(patterns, null, 2));
}

/** Log a design decision for future builds to reference */
export function logDesignDecision(niche, direction, fonts, colors) {
  const successDir = path.join(KNOWLEDGE_BASE, 'successes');
  ensureDir(successDir);

  const file = path.join(successDir, 'design-decisions.json');
  let decisions = [];
  if (fs.existsSync(file)) {
    try { decisions = JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { decisions = []; }
  }

  decisions.push({
    timestamp: new Date().toISOString(),
    niche: niche || 'unknown',
    direction: direction || 'unknown',
    fonts: fonts || {},
    colors: colors || {},
  });

  // Keep last 50 decisions
  if (decisions.length > 50) decisions = decisions.slice(-50);

  fs.writeFileSync(file, JSON.stringify(decisions, null, 2));
  console.log(`  Design decision logged for niche: ${niche}`);
}

/** Get build stats from knowledge base */
export function getBuildStats() {
  const buildsDir = path.join(KNOWLEDGE_BASE, 'builds');
  if (!fs.existsSync(buildsDir)) return { total: 0, success: 0, failed: 0, builds: [] };

  const files = fs.readdirSync(buildsDir).filter(f => f.endsWith('.json'));
  const builds = files.map(f => {
    try { return JSON.parse(fs.readFileSync(path.join(buildsDir, f), 'utf-8')); } catch { return null; }
  }).filter(Boolean);

  return {
    total: builds.length,
    success: builds.filter(b => b.status === 'success').length,
    failed: builds.filter(b => b.status !== 'success').length,
    builds,
  };
}

// CLI
const args = process.argv.slice(2);
if (args.length > 0) {
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

  if (flags.log) {
    const status = flags.status || 'unknown';
    logBuild(projectPath, status);
    process.exit(0);
  }

  if (flags.stats) {
    const stats = getBuildStats();
    console.log(`\nBuild Stats:`);
    console.log(`  Total: ${stats.total}`);
    console.log(`  Success: ${stats.success}`);
    console.log(`  Failed: ${stats.failed}`);
    process.exit(0);
  }

  console.error('Use --log --project <path> --status <status> or --stats');
  process.exit(1);
}
