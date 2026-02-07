/**
 * PREBUILD HOOK — runs before `npm run build`
 *
 * Enforces that all phases 0-6 are completed before building.
 * This is the hardest gate in the system — npm run build will not proceed if this fails.
 */
import { checkAllGates, getBuildState } from './lib/phase-gate.mjs';
import { validateImageManifest, validatePageRegistry, validateImagesTs, validateSiteConfig, validateFonts } from './lib/manifest-validator.mjs';
import { buildLog } from './lib/build-logger.mjs';

const args = process.argv.slice(2);
let projectPath = process.cwd();
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--project' && args[i + 1]) { projectPath = args[i + 1]; i++; }
}

console.log('\n═══ Pre-Build Validation ═══\n');

const errors = [];

// 1. Check build state exists and all phases through phase-6 are completed
const stateResult = getBuildState(projectPath);
if (!stateResult.exists) {
  console.error('✗ No build-state.json found.');
  console.error('  The build pipeline must be run through the orchestrator skill.');
  console.error('  Run: node scripts/lib/phase-gate.mjs --init --project .');
  process.exit(1);
}

if (!stateResult.valid) {
  console.error(`✗ Invalid build-state.json: ${stateResult.error}`);
  process.exit(1);
}

const gateResult = checkAllGates(projectPath, 'phase-6');
if (!gateResult.passed) {
  console.error('✗ Phase gates not satisfied:');
  console.error(gateResult.reason);
  console.error('\nAll phases 0-6 must be completed before building.');
  process.exit(1);
}
console.log('✓ All phases 0-6 completed');

// 1b. Check required context documents exist
{
  const { existsSync } = await import('node:fs');
  const { resolve } = await import('node:path');

  const businessContext = resolve(projectPath, 'BUSINESS-CONTEXT.md');
  if (!existsSync(businessContext)) {
    errors.push('BUSINESS-CONTEXT.md not found. Must be created before Phase 3 (see SKILL.md).');
  } else {
    console.log('✓ BUSINESS-CONTEXT.md exists');
  }

  const imagePrompts = resolve(projectPath, 'IMAGE-PROMPTS.md');
  if (!existsSync(imagePrompts)) {
    errors.push('IMAGE-PROMPTS.md not found. Must be generated before image generation (see Phase 6).');
  } else {
    console.log('✓ IMAGE-PROMPTS.md exists');
  }
}

// 2. Run manifest validation based on builder type
const builderType = stateResult.state.builderType;

if (builderType === 'template') {
  // Template builder: validate site.config.ts and images.ts
  const configResult = validateSiteConfig(projectPath);
  if (!configResult.valid) {
    errors.push(...configResult.errors.map(e => `site.config.ts: ${e}`));
  } else {
    console.log('✓ site.config.ts valid (no placeholders)');
  }

  const imagesResult = validateImagesTs(projectPath);
  if (!imagesResult.valid) {
    errors.push(...imagesResult.errors.map(e => `images.ts: ${e}`));
  } else {
    console.log('✓ src/images.ts valid (glob-based discovery)');
  }
} else {
  // Custom builder: validate image-manifest.json and page-registry.json
  const imageResult = validateImageManifest(projectPath);
  if (!imageResult.valid) {
    errors.push(...imageResult.errors.map(e => `image-manifest: ${e}`));
  } else {
    console.log('✓ image-manifest.json valid');
  }

  const pageResult = validatePageRegistry(projectPath);
  if (!pageResult.valid) {
    errors.push(...pageResult.errors.map(e => `page-registry: ${e}`));
  } else {
    console.log('✓ page-registry.json valid');
  }
}

// 3. Validate convention-based image folders have real images (not placeholder stubs)
if (builderType === 'template') {
  const { existsSync, readdirSync, statSync } = await import('node:fs');
  const { resolve, join } = await import('node:path');
  const imgBase = resolve(projectPath, 'src', 'assets', 'images');

  const requiredFolders = ['home-hero', 'inner-hero', 'gallery'];
  const isRealImage = (dir, f) => /\.(jpg|jpeg|png|webp)$/.test(f) && statSync(join(dir, f)).size > 1024;

  let realImageCount = 0;
  let placeholderCount = 0;

  for (const folder of requiredFolders) {
    const dir = resolve(imgBase, folder);
    if (!existsSync(dir)) {
      errors.push(`Required image folder missing: src/assets/images/${folder}/`);
      continue;
    }
    const files = readdirSync(dir).filter(f => /\.(jpg|jpeg|png|webp)$/.test(f));
    const real = files.filter(f => isRealImage(dir, f));
    const stubs = files.filter(f => !isRealImage(dir, f));
    realImageCount += real.length;
    placeholderCount += stubs.length;
    if (real.length === 0) {
      errors.push(`No real images in src/assets/images/${folder}/ (${stubs.length} placeholder stubs < 1KB). AI images must be generated before building.`);
    }
  }

  // Check service folders
  const servicesDir = resolve(imgBase, 'services');
  if (existsSync(servicesDir)) {
    const slugs = readdirSync(servicesDir).filter(f => statSync(join(servicesDir, f)).isDirectory());
    for (const slug of slugs) {
      for (const placement of ['card', 'hero', 'content']) {
        const dir = resolve(servicesDir, slug, placement);
        if (!existsSync(dir)) continue;
        const files = readdirSync(dir).filter(f => /\.(jpg|jpeg|png|webp)$/.test(f));
        const real = files.filter(f => isRealImage(dir, f));
        realImageCount += real.length;
        placeholderCount += files.length - real.length;
        if (real.length === 0) {
          errors.push(`No real images in services/${slug}/${placement}/ (placeholder stubs only). AI images must be generated.`);
        }
      }
    }
  }

  if (errors.length === 0 || realImageCount > 0) {
    console.log(`✓ ${realImageCount} real images found across convention folders${placeholderCount > 0 ? ` (${placeholderCount} placeholders remain)` : ''}`);
  }
}

// 3b. Validate generated-images-manifest.json confirms correct FAL model
if (builderType === 'template') {
  const { existsSync: existsManifest, readFileSync: readManifest } = await import('node:fs');
  const { resolve: resolveManifest } = await import('node:path');
  const manifestFile = resolveManifest(projectPath, 'generated-images-manifest.json');
  if (!existsManifest(manifestFile)) {
    errors.push('generated-images-manifest.json not found. Images must be generated via fal-api.mjs.');
  } else {
    try {
      const manifest = JSON.parse(readManifest(manifestFile, 'utf-8'));
      const REQUIRED_MODEL = 'fal-ai/nano-banana-pro';
      if (manifest.model !== REQUIRED_MODEL) {
        errors.push(`Wrong FAL model in manifest: "${manifest.model}". Required: "${REQUIRED_MODEL}". Re-generate images using fal-api.mjs.`);
      } else {
        console.log(`✓ Image generation manifest confirms model: ${manifest.model}`);
      }
      if (manifest.promptSource !== 'IMAGE-PROMPTS.md') {
        errors.push(`Images not generated from IMAGE-PROMPTS.md (promptSource: "${manifest.promptSource || 'missing'}"). Re-generate using fal-api.mjs.`);
      } else {
        console.log('✓ Image generation manifest confirms prompt source: IMAGE-PROMPTS.md');
      }
    } catch (e) {
      errors.push(`generated-images-manifest.json is invalid JSON: ${e.message}`);
    }
  }
}

// 4. Validate images.ts uses glob-based discovery (no manual sync needed)
if (builderType === 'template') {
  const { existsSync: exists2, readFileSync: readFile2 } = await import('node:fs');
  const { resolve: resolve2 } = await import('node:path');
  const imagesTsPath = resolve2(projectPath, 'src', 'images.ts');
  if (exists2(imagesTsPath)) {
    const itContent = readFile2(imagesTsPath, 'utf-8');
    if (!itContent.includes('import.meta.glob')) {
      errors.push('images.ts does not use import.meta.glob(). It must use glob-based discovery — no hardcoded imports.');
    } else {
      console.log('✓ images.ts uses glob-based discovery (auto-syncs with disk)');
    }
  } else {
    errors.push('src/images.ts not found.');
  }
}

// 5. Validate fonts exist for both builder types
const fontResult = validateFonts(projectPath);
if (!fontResult.valid) {
  errors.push(...fontResult.errors.map(e => `fonts: ${e}`));
} else {
  console.log('✓ Font files present for all configured fonts');
}

// 6. Report results
const log = buildLog(projectPath);
if (errors.length > 0) {
  for (const e of errors) log.error('validate-manifests', e);
  log.info('validate-manifests', `Pre-build validation FAILED with ${errors.length} errors`);
  console.error(`\n✗ Pre-build validation FAILED (${errors.length} errors):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

log.info('validate-manifests', 'Pre-build validation PASSED');
console.log('\n✓ Pre-build validation PASSED — build may proceed.\n');
process.exit(0);
