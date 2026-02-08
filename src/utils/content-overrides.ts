/**
 * Content Overrides — reads client-edits.json at build time
 * and provides a simple getter for components.
 *
 * Usage in .astro components:
 *   import { getEdit } from '../utils/content-overrides';
 *   <h1>{getEdit('homepage.heroTitle', site.homepage.heroTitle)}</h1>
 *
 * The data-edit="homepage.heroTitle" attribute on the element
 * tells the client-side editor script which key to write.
 *
 * If client-edits.json doesn't exist, every call returns the fallback.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

type Edits = Record<string, string>;

let edits: Edits | null = null;
let loaded = false;

function loadEdits(): Edits {
  if (loaded) return edits || {};
  loaded = true;

  const filePath = join(process.cwd(), 'client-edits.json');
  if (!existsSync(filePath)) return {};

  try {
    const raw = readFileSync(filePath, 'utf-8');
    edits = JSON.parse(raw) as Edits;
    return edits;
  } catch {
    // Malformed JSON — treat as no edits
    return {};
  }
}

/**
 * Get an edited value by dot-path key, falling back to the original.
 *
 * @param key   Dot-path matching the data-edit attribute (e.g. "homepage.heroTitle")
 * @param fallback  Original value from site.config
 * @returns The client-edited value if it exists, otherwise the fallback
 */
export function getEdit(key: string, fallback: string): string {
  const all = loadEdits();
  return all[key] ?? fallback;
}

/**
 * Check if an image override exists in client-edits.json.
 * Returns the public path (e.g. "/images/client-uploads/homepage-heroImage.jpg")
 * or null if no override exists.
 *
 * @param key  Dot-path matching the data-edit-image attribute (e.g. "homepage.heroImage")
 */
export function getImageEdit(key: string): string | null {
  const all = loadEdits();
  return all[key] ?? null;
}
