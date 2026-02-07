/**
 * Claude Code PreToolUse Hook — Manifest Protection
 *
 * Prevents accidental overwrites of validated manifests and config files
 * after their corresponding phases have been completed.
 *
 * Exit codes:
 *   0 = allow the operation
 *   2 = block the operation (with reason on stderr)
 */
import fs from 'node:fs';
import path from 'node:path';

// Protected files and the phase that validates them
const PROTECTED_FILES = {
  'build-state.json': null, // always allow (phase-gate.mjs manages this)
  'image-manifest.json': 'phase-7',    // protected after build phase starts
  'page-registry.json': 'phase-7',     // protected after build phase starts
  'src/site.config.ts': 'phase-7',     // protected after build phase starts
  'src/images.ts': 'phase-7',          // protected after build phase starts
};

// Read tool input from stdin
let input = '';
try {
  input = fs.readFileSync('/dev/stdin', 'utf-8');
} catch {
  // No stdin — allow by default
  process.exit(0);
}

let toolInput;
try {
  toolInput = JSON.parse(input);
} catch {
  process.exit(0); // Can't parse — allow
}

// Extract file path from tool input
const filePath = toolInput.file_path || toolInput.path || '';
if (!filePath) process.exit(0);

// Check if the target file is protected
const fileName = path.basename(filePath);
const relPath = filePath.includes('/src/') ? 'src/' + filePath.split('/src/')[1] : fileName;

const protectedPhase = PROTECTED_FILES[relPath] || PROTECTED_FILES[fileName];
if (!protectedPhase) process.exit(0); // Not a protected file

// Find build-state.json in the project directory
const projectDir = filePath.includes('/src/')
  ? filePath.split('/src/')[0]
  : path.dirname(filePath);
const buildStatePath = path.join(projectDir, 'build-state.json');

if (!fs.existsSync(buildStatePath)) process.exit(0); // No build state — allow

let state;
try {
  state = JSON.parse(fs.readFileSync(buildStatePath, 'utf-8'));
} catch {
  process.exit(0); // Can't read state — allow
}

// Check if the protecting phase is completed or in_progress
const phase = state.phases?.[protectedPhase];
if (phase && (phase.status === 'completed' || phase.status === 'in_progress')) {
  process.stderr.write(
    `BLOCKED: "${relPath}" is protected after ${protectedPhase} (${phase.status}). ` +
    `To modify this file, the build pipeline must be re-run from an earlier phase.\n`
  );
  process.exit(2);
}

process.exit(0);
