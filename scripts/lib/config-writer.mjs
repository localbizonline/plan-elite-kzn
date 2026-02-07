// ============================================================================
// config-writer.mjs
// ============================================================================
// Shared utility for reading and writing site.config.ts sections.
// Extracted from build-runner.mjs for reuse in sync.mjs, refresh-reviews.mjs,
// and populate-config.mjs.
//
// Key design: section replacement is idempotent — running it twice with the
// same data produces identical output. Running with different data correctly
// updates the config.
// ============================================================================

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Replace a top-level section in site.config.ts with new data.
 * Finds the section by key name and replaces the value.
 * Idempotent: same input → same output regardless of current state.
 */
export function replaceSection(config, sectionName, newValue) {
  // For arrays (services, nav)
  if (Array.isArray(newValue)) {
    const serialized = serializeToTS(newValue, 2);
    const regex = new RegExp(
      `(  ${sectionName}:\\s*)\\[[\\s\\S]*?\\n  \\],`,
      'm'
    );
    if (regex.test(config)) {
      return config.replace(regex, `  ${sectionName}: ${serialized},`);
    }
  }

  // For objects
  if (typeof newValue === 'object' && !Array.isArray(newValue)) {
    const serialized = serializeToTS(newValue, 2);
    const regex = new RegExp(
      `(  ${sectionName}:\\s*)\\{[\\s\\S]*?\\n  \\},`,
      'm'
    );
    if (regex.test(config)) {
      return config.replace(regex, `  ${sectionName}: ${serialized},`);
    }
  }

  // If no match found, log but don't fail
  console.log(`  Warning: Could not find section "${sectionName}" in site.config.ts`);
  return config;
}

/**
 * Serialize a JS value to TypeScript literal notation.
 */
export function serializeToTS(value, baseIndent = 0) {
  const json = JSON.stringify(value, null, 2);

  // Remove quotes from simple property keys (valid JS identifiers)
  let ts = json.replace(/"([a-zA-Z_$][a-zA-Z0-9_$]*)"\s*:/g, '$1:');

  // Indent each line to match the base indent
  const lines = ts.split('\n');
  return lines.map((line, i) => {
    if (i === 0) return line;
    return ' '.repeat(baseIndent) + line;
  }).join('\n');
}

/**
 * Replace a single key-value pair in site.config.ts using regex.
 * Idempotent: works whether the value is a template default or already populated.
 *
 * @param {string} config - Current config file content
 * @param {string} key - The key name (e.g., "name", "phone", "displayFont")
 * @param {string} newValue - The new value (will be JSON.stringify'd)
 * @returns {string} Updated config content
 */
export function replaceKeyValue(config, key, newValue) {
  // Match: key: "anything" or key: 'anything'
  const regex = new RegExp(`(${key}:\\s*)["'][^"']*["']`);
  const serialized = JSON.stringify(newValue);
  if (regex.test(config)) {
    return config.replace(regex, `$1${serialized}`);
  }
  return config;
}

/**
 * Replace a numeric key-value pair in site.config.ts.
 * @param {string} config - Current config file content
 * @param {string} key - The key name (e.g., "averageRating", "totalReviews")
 * @param {number} newValue - The new numeric value
 * @returns {string} Updated config content
 */
export function replaceNumericValue(config, key, newValue) {
  const regex = new RegExp(`(${key}:\\s*)\\d+\\.?\\d*`);
  if (regex.test(config)) {
    return config.replace(regex, `$1${newValue}`);
  }
  return config;
}

/**
 * Read site.config.ts from a project.
 * @param {string} projectPath
 * @returns {string} File content
 */
export function readConfig(projectPath) {
  const configPath = join(projectPath, 'src/site.config.ts');
  if (!existsSync(configPath)) {
    throw new Error(`site.config.ts not found at: ${configPath}`);
  }
  return readFileSync(configPath, 'utf-8');
}

/**
 * Write site.config.ts to a project.
 * @param {string} projectPath
 * @param {string} content
 */
export function writeConfig(projectPath, content) {
  const configPath = join(projectPath, 'src/site.config.ts');
  writeFileSync(configPath, content, 'utf-8');
}
