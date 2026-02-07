import fs from 'node:fs';
import path from 'node:path';

// ============================================================================
// build-logger.mjs
// ============================================================================
// Appends timestamped entries to BUILD-LOG.md in the project directory.
// Every script and skill should use this to record decisions, skips,
// fallbacks, fixes, and errors during a build.
//
// Categories:
//   SKIP     — intentionally skipped a step (with reason)
//   MISSING  — expected data/file was not found
//   FIX      — auto-fixed an issue
//   FALLBACK — fell back to an alternative source/method
//   WARNING  — non-blocking issue worth noting
//   ERROR    — blocking error encountered
//   INFO     — general progress note
//
// Usage (in scripts):
//   import { buildLog } from './build-logger.mjs';
//   const log = buildLog('/path/to/project');
//   log.skip('populate-images', 'No headshot in Airtable data');
//   log.fallback('populate-images', 'Gallery empty — will use AI-generated images');
//   log.fix('qa', 'Added missing trailing slash to /about link');
//
// Usage (CLI):
//   node scripts/lib/build-logger.mjs --project /path --init --company "SA Plumbing"
//   node scripts/lib/build-logger.mjs --project /path --log --level SKIP --source populate-images --message "No logo"
//   node scripts/lib/build-logger.mjs --project /path --summary
// ============================================================================

const LOG_FILE = 'BUILD-LOG.md';

const LEVELS = ['INFO', 'SKIP', 'MISSING', 'FALLBACK', 'FIX', 'WARNING', 'ERROR'];

const LEVEL_ICONS = {
  INFO: 'ℹ️',
  SKIP: '⏭️',
  MISSING: '❓',
  FALLBACK: '🔄',
  FIX: '🔧',
  WARNING: '⚠️',
  ERROR: '❌',
};

function timestamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function ensureLogFile(projectPath, companyName = 'Unknown') {
  const logPath = path.join(projectPath, LOG_FILE);
  if (!fs.existsSync(logPath)) {
    const header = `# Build Log: ${companyName}

**Started:** ${timestamp()}
**Builder:** local-service-template

---

| Time | Level | Source | Message |
|------|-------|--------|---------|
`;
    fs.writeFileSync(logPath, header, 'utf-8');
  }
  return logPath;
}

function appendEntry(projectPath, level, source, message) {
  const logPath = path.join(projectPath, LOG_FILE);
  if (!fs.existsSync(logPath)) {
    ensureLogFile(projectPath);
  }

  const icon = LEVEL_ICONS[level] || '';
  const line = `| ${timestamp()} | ${icon} ${level} | ${source} | ${message} |\n`;
  fs.appendFileSync(logPath, line, 'utf-8');
}

function appendSection(projectPath, heading, content) {
  const logPath = path.join(projectPath, LOG_FILE);
  if (!fs.existsSync(logPath)) {
    ensureLogFile(projectPath);
  }

  const section = `\n---\n\n## ${heading}\n\n${content}\n`;
  fs.appendFileSync(logPath, section, 'utf-8');
}

/**
 * Returns a logger bound to a project path.
 * Each method logs a specific category of event.
 */
export function buildLog(projectPath) {
  return {
    /** Initialize the log file with a header */
    init(companyName) {
      ensureLogFile(projectPath, companyName);
    },

    /** General progress note */
    info(source, message) {
      appendEntry(projectPath, 'INFO', source, message);
    },

    /** Intentionally skipped a step */
    skip(source, message) {
      appendEntry(projectPath, 'SKIP', source, message);
    },

    /** Expected data or file was not found */
    missing(source, message) {
      appendEntry(projectPath, 'MISSING', source, message);
    },

    /** Fell back to alternative source or method */
    fallback(source, message) {
      appendEntry(projectPath, 'FALLBACK', source, message);
    },

    /** Auto-fixed an issue */
    fix(source, message) {
      appendEntry(projectPath, 'FIX', source, message);
    },

    /** Non-blocking issue worth noting */
    warning(source, message) {
      appendEntry(projectPath, 'WARNING', source, message);
    },

    /** Blocking error encountered */
    error(source, message) {
      appendEntry(projectPath, 'ERROR', source, message);
    },

    /** Append a summary section (used at end of build) */
    section(heading, content) {
      appendSection(projectPath, heading, content);
    },

    /** Check if log file exists */
    exists() {
      return fs.existsSync(path.join(projectPath, LOG_FILE));
    },

    /** Get counts of each level */
    summary() {
      const logPath = path.join(projectPath, LOG_FILE);
      if (!fs.existsSync(logPath)) return null;

      const content = fs.readFileSync(logPath, 'utf-8');
      const counts = {};
      for (const level of LEVELS) {
        const regex = new RegExp(`\\| ${LEVEL_ICONS[level]}? ?${level} \\|`, 'g');
        counts[level] = (content.match(regex) || []).length;
      }
      return counts;
    },
  };
}

// --- CLI (only when executed directly, not when imported) ---
const isDirectExecution = process.argv[1]?.endsWith('build-logger.mjs');
if (isDirectExecution && process.argv.slice(2).length > 0) {
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

  if (flags.init) {
    log.init(flags.company || 'Unknown');
    console.log(`Build log initialized: ${path.join(projectPath, LOG_FILE)}`);
    process.exit(0);
  }

  if (flags.log) {
    const level = (flags.level || 'INFO').toUpperCase();
    const source = flags.source || 'cli';
    const message = flags.message || '';
    if (!LEVELS.includes(level)) {
      console.error(`Invalid level: ${level}. Use: ${LEVELS.join(', ')}`);
      process.exit(1);
    }
    appendEntry(projectPath, level, source, message);
    console.log(`Logged: [${level}] ${source} — ${message}`);
    process.exit(0);
  }

  if (flags.summary) {
    const counts = log.summary();
    if (!counts) {
      console.error('No BUILD-LOG.md found');
      process.exit(1);
    }
    console.log('\nBuild Log Summary:');
    for (const [level, count] of Object.entries(counts)) {
      if (count > 0) console.log(`  ${LEVEL_ICONS[level]} ${level}: ${count}`);
    }
    process.exit(0);
  }

  console.error('Use --init, --log, or --summary');
  process.exit(1);
}
