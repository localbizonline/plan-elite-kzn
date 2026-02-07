import fs from 'node:fs';
import path from 'node:path';
import { ImageManifest } from '../schemas/image-manifest.schema.mjs';
import { PageRegistry } from '../schemas/page-registry.schema.mjs';

/** Validate image-manifest.json (custom builder) */
export function validateImageManifest(projectPath) {
  const filePath = path.join(projectPath, 'image-manifest.json');
  const errors = [];

  if (!fs.existsSync(filePath)) {
    return { valid: false, errors: ['image-manifest.json does not exist'] };
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    return { valid: false, errors: [`Invalid JSON: ${e.message}`] };
  }

  const result = ImageManifest.safeParse(data);
  if (!result.success) {
    for (const issue of result.error.issues) {
      errors.push(`${issue.path.join('.')}: ${issue.message}`);
    }
    return { valid: false, errors };
  }

  // Check that referenced files exist on disk
  const images = result.data.images;
  const checkPath = (label, entry) => {
    if (entry && entry.path) {
      const full = path.join(projectPath, entry.path);
      if (!fs.existsSync(full)) errors.push(`${label}: file missing at ${entry.path}`);
    }
  };

  checkPath('logo', images.logo);
  checkPath('favicon', images.favicon);
  checkPath('ogImage', images.ogImage);
  if (images.heroes) {
    for (const [key, entry] of Object.entries(images.heroes)) {
      checkPath(`heroes.${key}`, entry);
    }
  }
  if (images.services) {
    for (const [key, entry] of Object.entries(images.services)) {
      checkPath(`services.${key}`, entry);
    }
  }
  if (images.gallery) {
    images.gallery.forEach((entry, i) => checkPath(`gallery[${i}]`, entry));
  }

  return { valid: errors.length === 0, errors };
}

/** Validate page-registry.json (custom builder) */
export function validatePageRegistry(projectPath) {
  const filePath = path.join(projectPath, 'page-registry.json');
  const errors = [];

  if (!fs.existsSync(filePath)) {
    return { valid: false, errors: ['page-registry.json does not exist'] };
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    return { valid: false, errors: [`Invalid JSON: ${e.message}`] };
  }

  const result = PageRegistry.safeParse(data);
  if (!result.success) {
    for (const issue of result.error.issues) {
      errors.push(`${issue.path.join('.')}: ${issue.message}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/** Validate src/images.ts uses glob-based discovery and key folders have content */
export function validateImagesTs(projectPath) {
  const filePath = path.join(projectPath, 'src', 'images.ts');
  const errors = [];

  if (!fs.existsSync(filePath)) {
    return { valid: false, errors: ['src/images.ts does not exist'] };
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  if (!content.includes('import.meta.glob')) {
    errors.push('src/images.ts does not use import.meta.glob() — may be outdated');
  }

  // Verify key image folders have content
  const imagesBase = path.join(projectPath, 'src', 'assets', 'images');
  const checkFolder = (name, required) => {
    const dir = path.join(imagesBase, name);
    if (!fs.existsSync(dir)) {
      if (required) errors.push(`Missing folder: src/assets/images/${name}/`);
      return;
    }
    const files = fs.readdirSync(dir).filter(f => /\.(jpg|jpeg|png|webp|svg|gif)$/.test(f));
    if (required && files.length === 0) {
      errors.push(`Empty required folder: src/assets/images/${name}/`);
    }
  };

  checkFolder('home-hero', true);
  checkFolder('inner-hero', true);
  checkFolder('gallery', true);
  checkFolder('logo', false);
  checkFolder('headshot', false);

  return { valid: errors.length === 0, errors };
}

/** Validate that fonts referenced in site.config.ts exist as woff2 files in public/fonts/ */
export function validateFonts(projectPath) {
  const configPath = path.join(projectPath, 'src', 'site.config.ts');
  const fontsDir = path.join(projectPath, 'public', 'fonts');
  const errors = [];

  if (!fs.existsSync(configPath)) {
    return { valid: false, errors: ['src/site.config.ts does not exist — cannot check fonts'] };
  }

  const content = fs.readFileSync(configPath, 'utf-8');
  const displayMatch = content.match(/displayFont:\s*["']([^"']+)["']/);
  const bodyMatch = content.match(/bodyFont:\s*["']([^"']+)["']/);
  const accentMatch = content.match(/accentFont:\s*["']([^"']+)["']/);

  const fontsToCheck = [];
  if (displayMatch) fontsToCheck.push({ role: 'displayFont', name: displayMatch[1] });
  if (bodyMatch) fontsToCheck.push({ role: 'bodyFont', name: bodyMatch[1] });
  if (accentMatch) fontsToCheck.push({ role: 'accentFont', name: accentMatch[1] });

  if (fontsToCheck.length === 0) {
    errors.push('No displayFont or bodyFont found in site.config.ts theme');
    return { valid: false, errors };
  }

  if (!fs.existsSync(fontsDir)) {
    errors.push('public/fonts/ directory does not exist');
    return { valid: false, errors };
  }

  const fontFiles = fs.readdirSync(fontsDir).filter((f) => f.endsWith('.woff2'));

  for (const { role, name } of fontsToCheck) {
    // Build expected slug: "Barlow Condensed" → "barlow-condensed"
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    // Check if any woff2 file matches this font slug
    const hasFile = fontFiles.some((f) => f.includes(slug));
    if (!hasFile) {
      errors.push(
        `${role} "${name}" — no woff2 file found in public/fonts/ matching "${slug}". ` +
        `Run: node scripts/download-fonts.mjs --project .`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

/** Validate site.config.ts has no placeholder values (template builder) */
export function validateSiteConfig(projectPath) {
  const filePath = path.join(projectPath, 'src', 'site.config.ts');
  const errors = [];

  if (!fs.existsSync(filePath)) {
    return { valid: false, errors: ['src/site.config.ts does not exist'] };
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const placeholders = [
    'Your Business Name',
    'PLACEHOLDER',
    'TODO:',
    'REPLACE_ME',
    'your-business',
    'example.com',
    '000-000-0000',
  ];

  for (const p of placeholders) {
    if (content.includes(p)) {
      errors.push(`site.config.ts contains placeholder: "${p}"`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// CLI (only when executed directly, not when imported)
const isDirectExecution = process.argv[1]?.endsWith('manifest-validator.mjs');
if (isDirectExecution && process.argv.slice(2).length > 0) {
  const args = process.argv.slice(2);
  let projectPath = process.cwd();
  let type = 'all';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--project' && args[i + 1]) { projectPath = args[i + 1]; i++; }
    if (args[i] === '--type' && args[i + 1]) { type = args[i + 1]; i++; }
  }

  const results = [];

  if (type === 'all' || type === 'images') {
    results.push({ name: 'image-manifest', ...validateImageManifest(projectPath) });
  }
  if (type === 'all' || type === 'pages') {
    results.push({ name: 'page-registry', ...validatePageRegistry(projectPath) });
  }
  if (type === 'all' || type === 'images-ts') {
    results.push({ name: 'images.ts', ...validateImagesTs(projectPath) });
  }
  if (type === 'all' || type === 'config') {
    results.push({ name: 'site.config.ts', ...validateSiteConfig(projectPath) });
  }
  if (type === 'all' || type === 'fonts') {
    results.push({ name: 'fonts', ...validateFonts(projectPath) });
  }

  let hasErrors = false;
  for (const r of results) {
    const icon = r.valid ? '✓' : '✗';
    console.log(`${icon} ${r.name}: ${r.valid ? 'valid' : 'INVALID'}`);
    for (const e of r.errors) {
      console.error(`    - ${e}`);
      hasErrors = true;
    }
  }

  process.exit(hasErrors ? 1 : 0);
}
