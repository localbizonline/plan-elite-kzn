#!/usr/bin/env node
// ============================================================================
// clone-template.mjs
// ============================================================================
// Clones the template project to a new directory for a client build.
//
// Usage:
//   node scripts/clone-template.mjs --name "sa-plumbing" --dest /path/to/Websites
//
// Output:
//   /path/to/Websites/sa-plumbing/  (complete Astro project ready for config)
// ============================================================================

import { existsSync, cpSync, mkdirSync, unlinkSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLog } from './lib/build-logger.mjs';
import { initBuildState, completePhase, updateMetadata } from './lib/phase-gate.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_ROOT = resolve(__dirname, '..');

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace(/^--/, '');
    const value = args[i + 1];
    if (key && value) parsed[key] = value;
  }
  return parsed;
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function main() {
  const args = parseArgs();
  const name = args.name;
  const dest = args.dest || resolve(TEMPLATE_ROOT, '..');

  if (!name) {
    console.error('Error: --name is required');
    console.error('Usage: node scripts/clone-template.mjs --name "sa-plumbing" [--dest /path/to]');
    process.exit(1);
  }

  const slug = slugify(name);
  const projectDir = resolve(dest, slug);

  if (existsSync(projectDir)) {
    console.error(`Error: Directory already exists: ${projectDir}`);
    console.error('Delete it first or choose a different name.');
    process.exit(1);
  }

  console.log(`Cloning template to: ${projectDir}`);

  // Copy everything except node_modules, dist, .astro
  cpSync(TEMPLATE_ROOT, projectDir, {
    recursive: true,
    filter: (src) => {
      const rel = src.replace(TEMPLATE_ROOT, '');
      if (rel.includes('node_modules')) return false;
      if (rel.includes('/dist/')) return false;
      if (rel.includes('/.astro/')) return false;
      if (rel.includes('.git/')) return false;
      return true;
    },
  });

  // Ensure content/locations is clean (remove example)
  const exampleLoc = join(projectDir, 'src/content/locations/example-city.json');
  if (existsSync(exampleLoc)) {
    unlinkSync(exampleLoc);
  }


  // Initialize build log in the new project
  const log = buildLog(projectDir);
  log.init(name);
  log.info('clone-template', `Template cloned to: ${projectDir}`);

  if (existsSync(join(projectDir, 'src/content/locations/example-city.json'))) {
    log.fix('clone-template', 'Removed example-city.json from template');
  }

  // Read template version from source package.json
  let templateVersion = '1.0.0';
  try {
    const pkg = JSON.parse(readFileSync(join(TEMPLATE_ROOT, 'package.json'), 'utf-8'));
    templateVersion = pkg.templateVersion || pkg.version || '1.0.0';
  } catch { /* use default */ }

  // Auto-initialize build-state.json so phase gates work immediately
  const buildId = `build-${Date.now()}`;
  initBuildState(projectDir, buildId, 'template', { source: 'clone-template', templateVersion });
  completePhase(projectDir, 'phase-0', {});
  updateMetadata(projectDir, { templateVersion });
  log.info('clone-template', `Build state initialized: ${buildId} (template v${templateVersion})`);

  console.log(`✓ Template cloned to: ${projectDir}`);
  console.log(`✓ Build state initialized (phase-0 complete)`);
  console.log(`\nNext steps:`);
  console.log(`  1. cd ${projectDir}`);
  console.log(`  2. node scripts/populate-config.mjs --project . --data client-config.json`);
  console.log(`  3. npm install && npm run build`);

  // Return the path for programmatic use
  return projectDir;
}

main();
