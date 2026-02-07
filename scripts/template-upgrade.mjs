#!/usr/bin/env node
// ============================================================================
// template-upgrade.mjs
// ============================================================================
// Upgrades a deployed project to the latest template version while preserving
// all client data (config, images, reviews, design tokens).
//
// Strategy:
//   1. Read current project's client-config.json + design-tokens.json
//   2. Re-clone latest template to a temp directory
//   3. Re-apply config + design tokens via populate-config.mjs
//   4. Copy client images back
//   5. Replace original project with upgraded version
//
// Usage:
//   node scripts/template-upgrade.mjs --project /path/to/project
//   node scripts/template-upgrade.mjs --project /path/to/project --dry-run
//
// ============================================================================

import { existsSync, readFileSync, writeFileSync, cpSync, mkdirSync, rmSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCliArgs, runScript, runCommand } from './lib/runner-utils.mjs';
import { buildLog } from './lib/build-logger.mjs';
import { getBuildState, updateMetadata } from './lib/phase-gate.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_ROOT = resolve(__dirname, '..');

async function main() {
  const args = parseCliArgs();
  const projectPath = args.project ? resolve(args.project) : null;
  const dryRun = args['dry-run'] === true;

  if (!projectPath) {
    console.error('Usage: node scripts/template-upgrade.mjs --project /path/to/project [--dry-run]');
    process.exit(1);
  }

  if (!existsSync(projectPath)) {
    console.error(`Project not found: ${projectPath}`);
    process.exit(1);
  }

  // Read current template version
  const buildState = getBuildState(projectPath);
  const currentVersion = buildState.valid ? (buildState.state.metadata?.templateVersion || 'unknown') : 'unknown';

  // Read latest template version
  let latestVersion = '1.0.0';
  try {
    const pkg = JSON.parse(readFileSync(join(TEMPLATE_ROOT, 'package.json'), 'utf-8'));
    latestVersion = pkg.templateVersion || pkg.version || '1.0.0';
  } catch { /* use default */ }

  console.log(`Current template version: ${currentVersion}`);
  console.log(`Latest template version:  ${latestVersion}`);

  if (currentVersion === latestVersion) {
    console.log('\nProject is already on the latest template version.');
    process.exit(0);
  }

  // Verify required client data files exist
  const requiredFiles = ['client-config.json', 'design-tokens.json'];
  for (const file of requiredFiles) {
    if (!existsSync(join(projectPath, file))) {
      console.error(`Missing required file: ${file}`);
      console.error('Cannot upgrade without client data files.');
      process.exit(1);
    }
  }

  console.log(`\nUpgrading ${basename(projectPath)} from v${currentVersion} to v${latestVersion}`);

  if (dryRun) {
    console.log('\n--dry-run: No changes applied.');
    console.log('The following would happen:');
    console.log('  1. Re-clone latest template');
    console.log('  2. Re-apply client-config.json + design-tokens.json');
    console.log('  3. Copy client images back');
    console.log('  4. Copy content files (reviews.json, locations, REVIEWS.md)');
    console.log('  5. npm install + npm run build');
    process.exit(0);
  }

  // Step 1: Create backup
  const backupDir = `${projectPath}-backup-${Date.now()}`;
  console.log(`\n  Creating backup: ${backupDir}`);
  cpSync(projectPath, backupDir, { recursive: true });

  try {
    // Step 2: Clone fresh template to a temp location
    const tmpDir = `${projectPath}-upgrade-tmp`;
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });

    console.log('  Cloning latest template...');
    cpSync(TEMPLATE_ROOT, tmpDir, {
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

    // Step 3: Copy client data files
    console.log('  Copying client data files...');
    const dataFiles = [
      'client-config.json',
      'design-tokens.json',
      'reviews.json',
      'REVIEWS.md',
      'BUSINESS-CONTEXT.md',
      'IMAGE-PROMPTS.md',
      'content-generated.json',
      'client-mapped.json',
      'build-state.json',
      'BUILD-LOG.md',
    ];
    for (const file of dataFiles) {
      const src = join(projectPath, file);
      if (existsSync(src)) {
        cpSync(src, join(tmpDir, file));
        console.log(`    Copied: ${file}`);
      }
    }

    // Step 4: Copy client images
    console.log('  Copying client images...');
    const imagesDir = join(projectPath, 'src/assets/images');
    const tmpImagesDir = join(tmpDir, 'src/assets/images');
    if (existsSync(imagesDir)) {
      cpSync(imagesDir, tmpImagesDir, { recursive: true });
      console.log('    Copied: src/assets/images/');
    }

    // Copy public images (og-image, favicon, etc.)
    const publicDir = join(projectPath, 'public');
    const tmpPublicDir = join(tmpDir, 'public');
    for (const file of ['og-image.jpg', 'og-image.webp', 'favicon.svg', 'favicon.ico']) {
      const src = join(publicDir, file);
      if (existsSync(src)) {
        cpSync(src, join(tmpPublicDir, file));
        console.log(`    Copied: public/${file}`);
      }
    }

    // Step 5: Copy content files
    const contentDir = join(projectPath, 'src/content');
    const tmpContentDir = join(tmpDir, 'src/content');
    if (existsSync(contentDir)) {
      cpSync(contentDir, tmpContentDir, { recursive: true });
      console.log('    Copied: src/content/');
    }

    // Step 6: Copy .git directory for deployment continuity
    const gitDir = join(projectPath, '.git');
    if (existsSync(gitDir)) {
      cpSync(gitDir, join(tmpDir, '.git'), { recursive: true });
      console.log('    Copied: .git/');
    }

    // Step 7: Re-apply config + design tokens
    console.log('  Re-applying client config + design tokens...');
    runScript(join(tmpDir, 'scripts/populate-config.mjs'), [
      '--project', tmpDir,
      '--data', join(tmpDir, 'client-config.json'),
      '--design', join(tmpDir, 'design-tokens.json'),
    ]);

    // Step 8: npm install
    console.log('  Running npm install...');
    runCommand('npm install', { cwd: tmpDir, timeout: 180_000 });

    // Step 9: Replace original with upgraded version
    console.log('  Replacing original project...');
    rmSync(projectPath, { recursive: true, force: true });
    cpSync(tmpDir, projectPath, { recursive: true });
    rmSync(tmpDir, { recursive: true, force: true });

    // Step 10: Update metadata
    updateMetadata(projectPath, { templateVersion: latestVersion });

    const log = buildLog(projectPath);
    log.info('template-upgrade', `Upgraded from v${currentVersion} to v${latestVersion}`);

    console.log(`\nUpgrade complete: v${currentVersion} → v${latestVersion}`);
    console.log(`Backup at: ${backupDir}`);
    console.log('\nNext steps:');
    console.log('  1. npm run build  (verify build succeeds)');
    console.log('  2. npm run dev    (preview locally)');
    console.log('  3. git add -A && git commit -m "chore: upgrade template" && git push');
    console.log(`  4. Once verified, delete backup: rm -rf ${backupDir}`);

  } catch (err) {
    console.error(`\nUpgrade failed: ${err.message}`);
    console.error(`Backup preserved at: ${backupDir}`);
    console.error('Restore with:');
    console.error(`  rm -rf ${projectPath} && mv ${backupDir} ${projectPath}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(`Template upgrade failed: ${err.message}`);
  process.exit(1);
});
