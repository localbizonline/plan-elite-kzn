#!/usr/bin/env node
// ============================================================================
// generate-theme.mjs
// ============================================================================
// Reads theme values from site.config.ts and regenerates global.css.
// Fonts are loaded from src/font-registry.json (pre-bundled in template).
//
// Usage:
//   node scripts/generate-theme.mjs --project /path/to/project
//
// Reads: src/site.config.ts (theme object), src/font-registry.json
// Writes: src/styles/global.css
// ============================================================================

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { buildLog } from './lib/build-logger.mjs';

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

/**
 * Extract theme values from site.config.ts using regex.
 * This avoids needing to import the TypeScript file directly.
 *
 * IMPORTANT: site.config.ts has TWO `theme:` blocks — the TypeScript interface
 * definition (values are `string`) and the actual config object (values are
 * quoted strings like "#1E40AF"). We must skip the interface definition.
 */
function extractTheme(configContent) {
  // Find ALL theme blocks, then pick the one with actual values (not TS types)
  const themeBlocks = [...configContent.matchAll(/theme:\s*\{([\s\S]*?)\n\s{2}\}/g)];
  if (themeBlocks.length === 0) {
    console.error('Could not find theme object in site.config.ts');
    process.exit(1);
  }

  for (const match of themeBlocks) {
    const block = match[1];
    const parsed = parseThemeBlock(block);
    // The interface definition has no quoted values — skip blocks with zero parsed keys
    // or blocks where values look like TS types (e.g. "string", "number")
    const keys = Object.keys(parsed);
    if (keys.length === 0) continue;
    const hasRealValues = keys.some(k => parsed[k] && !['string', 'number', 'boolean'].includes(parsed[k]));
    if (hasRealValues) return parsed;
  }

  // Fallback: return last block parsed (most likely the actual config)
  const lastBlock = themeBlocks[themeBlocks.length - 1][1];
  return parseThemeBlock(lastBlock);
}

function parseThemeBlock(block) {
  const theme = {};
  const lines = block.split('\n');
  for (const line of lines) {
    // Skip comment lines
    if (line.trim().startsWith('//')) continue;
    const match = line.match(/(\w+):\s*["']([^"']+)["']/);
    if (match) {
      theme[match[1]] = match[2];
    }
  }
  return theme;
}

/**
 * Load the font registry (pre-bundled fonts with metadata).
 * Falls back to disk discovery if registry is missing.
 */
function loadFontRegistry(projectDir) {
  const registryPath = join(projectDir, 'src/font-registry.json');
  if (existsSync(registryPath)) {
    const registry = JSON.parse(readFileSync(registryPath, 'utf-8'));
    // Convert registry format to { 'Font Family': { faces: [{ weight, file }] } }
    const result = {};
    for (const [slug, font] of Object.entries(registry.fonts)) {
      const faces = Object.entries(font.files).map(([weight, file]) => ({
        weight: weight === '400' ? 'regular' : weight,
        file,
      }));
      result[font.family] = { faces };
    }
    return result;
  }

  // Fallback: discover fonts from disk (for projects without font-registry.json)
  console.warn('  ⚠ font-registry.json not found — discovering fonts from disk');
  return discoverFontsFromDisk(join(projectDir, 'public/fonts'));
}

/**
 * Fallback: Scan public/fonts/ for woff2 files when no registry exists.
 * Filename convention: <slug>-latin-<weight>.woff2
 */
function discoverFontsFromDisk(fontsDir) {
  if (!existsSync(fontsDir)) return {};
  const discovered = {};
  const files = readdirSync(fontsDir).filter((f) => f.endsWith('.woff2'));
  for (const file of files) {
    const base = file.replace(/\.woff2$/, '');
    const latinIdx = base.lastIndexOf('-latin-');
    if (latinIdx === -1) continue;
    const slug = base.slice(0, latinIdx);
    const weightPart = base.slice(latinIdx + 7);
    const fontName = slug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    if (!discovered[fontName]) discovered[fontName] = { faces: [] };
    discovered[fontName].faces.push({ weight: weightPart, file });
  }
  return discovered;
}

function generateFontFaces(displayFont, bodyFont, accentFont, projectDir) {
  const fontsDir = join(projectDir, 'public/fonts');
  const fontRegistry = loadFontRegistry(projectDir);

  let css = '';

  // Collect unique fonts (display, body, and optional accent)
  const fontNames = [...new Set([displayFont, bodyFont, accentFont].filter(Boolean))];

  for (const name of fontNames) {
    const fontDef = fontRegistry[name];
    if (!fontDef) {
      css += `/* Font "${name}" not found in font-registry.json */\n`;
      console.warn(`  ⚠ Font "${name}" not found in font registry`);
      continue;
    }
    for (const face of fontDef.faces) {
      const fontPath = join(fontsDir, face.file);
      if (!existsSync(fontPath)) {
        console.warn(`  ⚠ Font file missing: public/fonts/${face.file}`);
      }
      css += `@font-face {
  font-family: "${name}";
  font-style: normal;
  font-weight: ${face.weight === 'regular' ? '400' : face.weight};
  font-display: swap;
  src: url("/fonts/${face.file}") format("woff2");
}\n\n`;
    }
  }

  return css;
}

function generateGlobalCss(theme, projectDir) {
  const displayFont = theme.displayFont || 'Oswald';
  const bodyFont = theme.bodyFont || 'Open Sans';
  const accentFont = theme.accentFont || null;

  // Determine serif/sans-serif fallback per font
  const registryPath = join(projectDir, 'src/font-registry.json');
  let fontCategories = {};
  if (existsSync(registryPath)) {
    const registry = JSON.parse(readFileSync(registryPath, 'utf-8'));
    for (const font of Object.values(registry.fonts)) {
      fontCategories[font.family] = font.category || 'sans-serif';
    }
  }
  const displayFallback = fontCategories[displayFont] || 'sans-serif';
  const bodyFallback = fontCategories[bodyFont] || 'sans-serif';
  const accentFallback = accentFont ? (fontCategories[accentFont] || 'sans-serif') : null;

  const accentFontVar = accentFont
    ? `\n  --font-accent: "${accentFont}", ${accentFallback};`
    : '';

  const accentFontCss = accentFont
    ? `\n/* Accent font — use on badges, stats, pull quotes, special UI */\n.font-accent {\n  font-family: var(--font-accent);\n}\n`
    : '';

  return `/* ==========================================================================
   GLOBAL STYLES — Auto-generated by scripts/generate-theme.mjs
   DO NOT EDIT MANUALLY — edit site.config.ts theme values and re-run script
   ========================================================================== */

@import "tailwindcss";

/* Font Faces */
${generateFontFaces(displayFont, bodyFont, accentFont, projectDir)}
/* Theme Variables */
@theme {
  --font-display: "${displayFont}", ${displayFallback};
  --font-body: "${bodyFont}", ${bodyFallback};${accentFontVar}
  --color-primary: ${theme.primary || '#1B2A4A'};
  --color-primary-light: ${theme.primaryLight || '#2D4370'};
  --color-accent: ${theme.accent || '#D42027'};
  --color-accent-light: ${theme.accentLight || '#E8434A'};
  --color-background: ${theme.background || '#F8F9FA'};
  --color-surface: ${theme.surface || '#FFFFFF'};
  --color-text: ${theme.text || '#1B2A4A'};
  --color-muted: ${theme.muted || '#6B7280'};
}

/* Base Styles */
h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-display);
  font-weight: 900;
  text-transform: uppercase;
}

body {
  font-family: var(--font-body);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
${accentFontCss}
/* Smooth scrolling */
html {
  scroll-behavior: smooth;
}

/* Focus styles for accessibility */
:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
`;
}

/**
 * Parse hex color to RGB components.
 */
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

/**
 * Convert RGB to HSL.
 */
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: h * 360, s, l };
}

/**
 * Calculate perceptual color distance between two hex colors.
 * Uses hue difference, saturation difference, and lightness difference.
 * Returns a score from 0 (identical) to 1 (maximally different).
 */
function colorDistance(hex1, hex2) {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  const hsl1 = rgbToHsl(rgb1.r, rgb1.g, rgb1.b);
  const hsl2 = rgbToHsl(rgb2.r, rgb2.g, rgb2.b);

  // Hue distance (circular, 0-180 mapped to 0-1)
  let hueDiff = Math.abs(hsl1.h - hsl2.h);
  if (hueDiff > 180) hueDiff = 360 - hueDiff;
  const hueScore = hueDiff / 180;

  // Saturation and lightness difference (0-1)
  const satScore = Math.abs(hsl1.s - hsl2.s);
  const lightScore = Math.abs(hsl1.l - hsl2.l);

  // Weighted: hue matters most for "looks different", lightness second
  return hueScore * 0.5 + lightScore * 0.3 + satScore * 0.2;
}

/**
 * Check WCAG relative luminance contrast ratio between two colors.
 * Returns ratio (1:1 to 21:1). WCAG AA requires 4.5:1 for text, 3:1 for large text/UI.
 */
function contrastRatio(hex1, hex2) {
  function luminance(hex) {
    const rgb = hexToRgb(hex);
    const [rs, gs, bs] = [rgb.r, rgb.g, rgb.b].map((c) => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }
  const l1 = luminance(hex1);
  const l2 = luminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Validate that accent colors provide sufficient contrast against primary and background.
 * Logs warnings when colors are too similar.
 */
function validateColorContrast(theme, log) {
  const primary = theme.primary || '#1B2A4A';
  const accent = theme.accent || '#D42027';
  const background = theme.background || '#F8F9FA';
  const primaryLight = theme.primaryLight || '#2D4370';
  const accentLight = theme.accentLight || accent;

  const issues = [];

  // Check accent vs primary (buttons/icons on primary backgrounds)
  const accentPrimaryDist = colorDistance(accent, primary);
  const accentPrimaryContrast = contrastRatio(accent, primary);
  if (accentPrimaryDist < 0.25) {
    issues.push(`Accent (${accent}) is too similar to Primary (${primary}) — distance: ${accentPrimaryDist.toFixed(2)}. Buttons and icons will not stand out on dark backgrounds.`);
  }
  if (accentPrimaryContrast < 3) {
    issues.push(`Accent (${accent}) has poor contrast against Primary (${primary}) — ratio: ${accentPrimaryContrast.toFixed(1)}:1. WCAG requires at least 3:1 for UI elements.`);
  }

  // Check accent vs primaryLight (icons on lighter primary overlays)
  const accentPLightDist = colorDistance(accent, primaryLight);
  if (accentPLightDist < 0.2) {
    issues.push(`Accent (${accent}) is too similar to Primary Light (${primaryLight}) — distance: ${accentPLightDist.toFixed(2)}. Icons won't stand out.`);
  }

  // Check accentLight vs primary (hover states on dark backgrounds)
  const accentLightPrimaryDist = colorDistance(accentLight, primary);
  if (accentLightPrimaryDist < 0.2) {
    issues.push(`Accent Light (${accentLight}) is too similar to Primary (${primary}) — distance: ${accentLightPrimaryDist.toFixed(2)}. Hover states won't be visible.`);
  }

  // Check accent on background (buttons on light sections)
  const accentBgContrast = contrastRatio(accent, background);
  if (accentBgContrast < 3) {
    issues.push(`Accent (${accent}) has poor contrast against Background (${background}) — ratio: ${accentBgContrast.toFixed(1)}:1. Buttons won't stand out on light sections.`);
  }

  // Check white text readability on accent buttons
  const whiteOnAccent = contrastRatio(accent, '#FFFFFF');
  if (whiteOnAccent < 4.5) {
    issues.push(`White text on Accent (${accent}) has poor readability — ratio: ${whiteOnAccent.toFixed(1)}:1. WCAG AA requires 4.5:1.`);
  }

  if (issues.length > 0) {
    console.warn('\n⚠️  COLOR CONTRAST ISSUES DETECTED:');
    for (const issue of issues) {
      console.warn(`   • ${issue}`);
      log.warning('generate-theme', issue);
    }
    console.warn('\n   Fix: Choose an accent color with a different hue from the primary.');
    console.warn('   Good combos: dark blue primary + orange/yellow/red accent,');
    console.warn('   dark green primary + gold/coral accent, dark gray + bright teal/orange.\n');
  } else {
    log.info('generate-theme', `Color contrast OK: accent (${accent}) vs primary (${primary}) distance=${accentPrimaryDist.toFixed(2)}, contrast=${accentPrimaryContrast.toFixed(1)}:1`);
  }

  return issues;
}

function main() {
  const args = parseArgs();
  const projectDir = args.project || process.cwd();

  const configPath = join(projectDir, 'src/site.config.ts');
  if (!existsSync(configPath)) {
    console.error(`Error: site.config.ts not found at: ${configPath}`);
    process.exit(1);
  }

  const log = buildLog(projectDir);
  const configContent = readFileSync(configPath, 'utf-8');
  const theme = extractTheme(configContent);

  // Log missing/default theme values
  if (!theme.displayFont) log.fallback('generate-theme', 'No displayFont in theme — using default: Oswald');
  if (!theme.bodyFont) log.fallback('generate-theme', 'No bodyFont in theme — using default: Open Sans');
  if (!theme.primary) log.fallback('generate-theme', 'No primary color in theme — using default: #1B2A4A');
  if (!theme.accent) log.fallback('generate-theme', 'No accent color in theme — using default: #D42027');

  // Validate color contrast between accent and primary/background
  validateColorContrast(theme, log);

  console.log('Extracted theme:');
  console.log(`  Display font:  ${theme.displayFont || 'Oswald'}`);
  console.log(`  Body font:     ${theme.bodyFont || 'Open Sans'}`);
  if (theme.accentFont) console.log(`  Accent font:   ${theme.accentFont}`);
  console.log(`  Primary: ${theme.primary}`);
  console.log(`  Accent:  ${theme.accent}`);

  const css = generateGlobalCss(theme, projectDir);
  const cssPath = join(projectDir, 'src/styles/global.css');
  writeFileSync(cssPath, css, 'utf-8');

  const fontSummary = `display=${theme.displayFont || 'Oswald'}, body=${theme.bodyFont || 'Open Sans'}${theme.accentFont ? `, accent=${theme.accentFont}` : ''}`;
  log.info('generate-theme', `Theme CSS generated: ${fontSummary}, primary=${theme.primary || 'default'}, accent=${theme.accent || 'default'}`);
  console.log(`\n✓ global.css generated at: ${cssPath}`);
}

main();
