import { z } from 'zod';

// ============================================================================
// QA Result Schemas
// ============================================================================
// Zod schemas for all Phase 9 QA output files. Used by validate-qa.mjs
// and phase-gate.mjs to enforce that all QA agents ran and produced valid output.
// ============================================================================

// --- Shared primitives ---

const QaFailure = z.object({
  page: z.string().optional(),
  check: z.string(),
  detail: z.string(),
});

const QaWarning = z.object({
  page: z.string().optional(),
  check: z.string(),
  detail: z.string(),
});

// --- Phase 9a: SEO QA ---

export const SeoQaResult = z.object({
  timestamp: z.string(),
  deployUrl: z.string().url(),
  attempt: z.number().int().min(1),
  agent: z.literal('seo-qa'),
  summary: z.object({
    pages: z.number().int().min(0),
    checks: z.number().int().min(0),
    errors: z.number().int().min(0),
    warnings: z.number().int().min(0),
  }),
  passed: z.boolean(),
  failures: z.array(QaFailure).default([]),
  warnings: z.array(QaWarning).default([]),
});

// --- Phase 9b: Design Review ---

const DesignError = z.object({
  page: z.string(),
  issue: z.string(),
  detail: z.string(),
  screenshot: z.string().optional(),
  fix: z.string().optional(),
});

const DesignWarning = z.object({
  page: z.string(),
  issue: z.string(),
  detail: z.string(),
  screenshot: z.string().optional(),
});

export const DesignReviewResult = z.object({
  timestamp: z.string(),
  deployUrl: z.string().url(),
  attempt: z.number().int().min(1),
  agent: z.literal('design-reviewer'),
  designDirection: z.string().optional(),
  overallImpression: z.string().optional(),
  summary: z.object({
    pagesReviewed: z.number().int().min(0),
    errors: z.number().int().min(0),
    warnings: z.number().int().min(0),
  }),
  passed: z.boolean(),
  errors: z.array(DesignError).default([]),
  warnings: z.array(DesignWarning).default([]),
  fixes: z.array(z.string()).default([]),
});

// --- Phase 9c: Image QA ---

export const ImageQaResult = z.object({
  timestamp: z.string(),
  attempt: z.number().int().min(1),
  agent: z.literal('image-qa'),
  summary: z.object({
    expectedImages: z.number().int().min(0),
    found: z.number().int().min(0),
    placeholders: z.number().int().min(0),
    duplicates: z.number().int().min(0),
    missingImports: z.number().int().min(0),
    errors: z.number().int().min(0),
    warnings: z.number().int().min(0),
  }),
  passed: z.boolean(),
  errors: z.array(z.object({ check: z.string(), detail: z.string() })).default([]),
  warnings: z.array(z.object({ check: z.string(), detail: z.string() })).default([]),
  imageInventory: z.object({
    generated: z.array(z.string()).default([]),
    brand: z.array(z.string()).default([]),
    gallery: z.array(z.string()).default([]),
  }).optional(),
});

// --- Screenshot Manifest (written by screenshot-qa.mjs) ---

const ScreenshotEntry = z.object({
  route: z.string(),
  slug: z.string(),
  desktop: z.string().optional(),
  mobile: z.string().optional(),
  status: z.enum(['ok', 'error']),
  error: z.string().optional(),
});

export const ScreenshotManifest = z.object({
  deployUrl: z.string().url(),
  timestamp: z.string(),
  screenshots: z.array(ScreenshotEntry).min(1),
});

// --- Merged qa-results.json (created by validate-qa.mjs) ---

const AgentSummary = z.object({
  status: z.enum(['pass', 'fail']),
  errors: z.number().int().min(0),
  warnings: z.number().int().min(0).optional(),
});

export const MergedQaResult = z.object({
  timestamp: z.string(),
  deployUrl: z.string().url(),
  attempt: z.number().int().min(1),
  agents: z.object({
    'seo-qa': AgentSummary,
    'design-reviewer': AgentSummary,
    'image-qa': AgentSummary,
  }),
  passed: z.boolean(),
  totalErrors: z.number().int().min(0),
  totalWarnings: z.number().int().min(0),
  allFailures: z.array(z.string()).default([]),
  screenshotsCaptured: z.number().int().min(0),
});
