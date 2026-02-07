import { z } from 'zod';

export const PHASE_IDS = [
  'phase-0',   // Health Check
  'phase-1',   // Data Gathering
  'phase-2',   // Design Direction
  'phase-3',   // Project Scaffold / Clone Template
  'phase-4',   // Content Generation / Populate Config
  'phase-5',   // Theme & Locations / Image Workflow prep
  'phase-6',   // Images / Components & Pages
  'phase-7a',  // Fast Build (before images, for progressive deploy)
  'phase-7b',  // Fast Deploy (live URL with placeholders)
  'phase-7',   // Full Build (after images)
  'phase-8',   // Deploy (final)
  'phase-9',   // QA Verification
  'phase-10',  // Learn
];

export const PhaseStatus = z.enum(['pending', 'in_progress', 'completed', 'failed']);

export const PhaseEntry = z.object({
  status: PhaseStatus,
  completedAt: z.string().datetime().optional(),
  artifacts: z.record(z.string(), z.string()).optional(),
  error: z.string().optional(),
});

export const BuildState = z.object({
  buildId: z.string().min(1),
  builderType: z.enum(['custom', 'template']),
  startedAt: z.string().datetime(),
  projectPath: z.string().min(1),
  metadata: z.object({
    companyName: z.string().optional(),
    niche: z.string().optional(),
    deployUrl: z.string().url().optional(),
    repoUrl: z.string().url().optional(),
    templateVersion: z.string().optional(),
  }),
  phases: z.object({
    'phase-0': PhaseEntry,
    'phase-1': PhaseEntry,
    'phase-2': PhaseEntry,
    'phase-3': PhaseEntry,
    'phase-4': PhaseEntry,
    'phase-5': PhaseEntry,
    'phase-6': PhaseEntry,
    'phase-7a': PhaseEntry,
    'phase-7b': PhaseEntry,
    'phase-7': PhaseEntry,
    'phase-8': PhaseEntry,
    'phase-9': PhaseEntry,
    'phase-10': PhaseEntry,
  }),
});

/** Create a fresh build state with all phases pending */
export function createInitialState(buildId, builderType, projectPath, metadata = {}) {
  const phases = {};
  for (const id of PHASE_IDS) {
    phases[id] = { status: 'pending' };
  }
  return {
    buildId,
    builderType,
    startedAt: new Date().toISOString(),
    projectPath,
    metadata,
    phases,
  };
}
