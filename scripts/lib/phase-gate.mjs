import fs from 'node:fs';
import path from 'node:path';
import { BuildState, PHASE_IDS, createInitialState } from '../schemas/build-state.schema.mjs';
import { validateSiteConfig } from './config-validator.mjs';

const BUILD_STATE_FILE = 'build-state.json';

// Artifact checks per phase — verifies files actually exist on disk
const ARTIFACT_CHECKS = {
  'phase-1': (projectPath, builderType) => {
    const configPath = path.join(projectPath, 'client-config.json');
    if (!fs.existsSync(configPath)) return 'client-config.json does not exist';
    return null;
  },
  'phase-3': (projectPath, builderType) => {
    const siteConfig = path.join(projectPath, 'src', 'site.config.ts');
    const pkg = path.join(projectPath, 'package.json');
    const buildLog = path.join(projectPath, 'BUILD-LOG.md');
    const businessContext = path.join(projectPath, 'BUSINESS-CONTEXT.md');
    if (!fs.existsSync(siteConfig)) return 'src/site.config.ts does not exist';
    if (!fs.existsSync(pkg)) return 'package.json does not exist';
    if (!fs.existsSync(buildLog)) return 'BUILD-LOG.md does not exist — run clone-template or initialize manually';
    if (!fs.existsSync(businessContext)) return 'BUSINESS-CONTEXT.md does not exist — must be created before Phase 3 clone (see SKILL.md)';
    return null;
  },
  'phase-4': (projectPath, builderType) => {
    if (builderType === 'template') {
      const config = path.join(projectPath, 'src', 'site.config.ts');
      if (!fs.existsSync(config)) return 'src/site.config.ts does not exist';

      // Run full Zod config validation
      const validation = validateSiteConfig(projectPath);
      if (!validation.valid) {
        // Return the first error — most actionable
        return `Config validation failed: ${validation.errors[0]}`;
      }
    } else {
      const contentDir = path.join(projectPath, 'src', 'content');
      if (!fs.existsSync(contentDir)) return 'src/content/ directory does not exist';
      const registry = path.join(projectPath, 'page-registry.json');
      if (!fs.existsSync(registry)) return 'page-registry.json does not exist';
    }
    return null;
  },
  'phase-5': (projectPath, builderType) => {
    if (builderType === 'template') {
      const css = path.join(projectPath, 'src', 'styles', 'global.css');
      if (!fs.existsSync(css)) return 'src/styles/global.css does not exist';
    } else {
      const registry = path.join(projectPath, 'page-registry.json');
      if (!fs.existsSync(registry)) return 'page-registry.json does not exist';
    }
    return null;
  },
  'phase-6': (projectPath, builderType) => {
    if (builderType === 'template') {
      const imagesTs = path.join(projectPath, 'src', 'images.ts');
      if (!fs.existsSync(imagesTs)) return 'src/images.ts does not exist';
      const content = fs.readFileSync(imagesTs, 'utf-8');
      if (!content.includes('import.meta.glob')) {
        return 'src/images.ts does not use import.meta.glob() — may be outdated';
      }

      // Verify key placement folders exist and have real images (not placeholder stubs)
      const imagesBase = path.join(projectPath, 'src', 'assets', 'images');
      const requiredFolders = ['home-hero', 'inner-hero', 'gallery'];
      for (const folder of requiredFolders) {
        const dir = path.join(imagesBase, folder);
        if (!fs.existsSync(dir)) return `Missing required image folder: ${folder}/`;
        const files = fs.readdirSync(dir).filter(f => /\.(jpg|jpeg|png|webp|svg|gif)$/.test(f));
        if (files.length === 0) return `Image folder empty: ${folder}/`;
        const stubs = files.filter(f => fs.statSync(path.join(dir, f)).size < 1024);
        if (stubs.length === files.length) return `All images in ${folder}/ are placeholders (< 1KB)`;
      }

      // Verify each service has card/hero/content images
      const siteConfigPath = path.join(projectPath, 'src', 'site.config.ts');
      if (fs.existsSync(siteConfigPath)) {
        const configContent = fs.readFileSync(siteConfigPath, 'utf-8');
        const slugMatches = [...configContent.matchAll(/slug:\s*["']([^"']+)["']/g)];
        for (const [, slug] of slugMatches) {
          for (const placement of ['card', 'hero', 'content']) {
            const dir = path.join(imagesBase, 'services', slug, placement);
            if (!fs.existsSync(dir)) return `Missing service image folder: services/${slug}/${placement}/`;
            const files = fs.readdirSync(dir).filter(f => /\.(jpg|jpeg|png|webp)$/.test(f));
            if (files.length === 0) return `No image in services/${slug}/${placement}/`;
            if (files.every(f => fs.statSync(path.join(dir, f)).size < 1024)) {
              return `Placeholder stub in services/${slug}/${placement}/ — needs FAL generation`;
            }
          }
        }
      }

      // Verify IMAGE-PROMPTS.md exists (generated per-build from BUSINESS-CONTEXT.md + rules)
      const imagePrompts = path.join(projectPath, 'IMAGE-PROMPTS.md');
      if (!fs.existsSync(imagePrompts)) {
        return 'IMAGE-PROMPTS.md does not exist — must be generated before image generation (see teammate-image-processor.md Stage 2)';
      }

      // Verify generated-images-manifest.json exists and confirms correct model
      const manifestPath = path.join(projectPath, 'generated-images-manifest.json');
      if (!fs.existsSync(manifestPath)) {
        return 'generated-images-manifest.json does not exist. Images must be generated via fal-api.mjs (which writes this manifest).';
      }
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        const REQUIRED_MODEL = 'fal-ai/nano-banana-pro';
        if (manifest.model !== REQUIRED_MODEL) {
          return `Wrong FAL model used: "${manifest.model}". Required: "${REQUIRED_MODEL}". Re-generate images using fal-api.mjs.`;
        }
        if (manifest.promptSource !== 'IMAGE-PROMPTS.md') {
          return `Images were not generated from IMAGE-PROMPTS.md (promptSource: "${manifest.promptSource || 'missing'}"). Re-generate using fal-api.mjs which reads prompts from IMAGE-PROMPTS.md.`;
        }
      } catch (e) {
        return `generated-images-manifest.json is invalid JSON: ${e.message}`;
      }
    } else {
      const manifest = path.join(projectPath, 'image-manifest.json');
      if (!fs.existsSync(manifest)) return 'image-manifest.json does not exist';
    }
    return null;
  },
  'phase-8': (projectPath, builderType) => {
    // Require deployUrl in build-state metadata
    const stateFile = path.join(projectPath, 'build-state.json');
    if (!fs.existsSync(stateFile)) return 'build-state.json does not exist';
    try {
      const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
      if (!state.metadata?.deployUrl) {
        return 'deployUrl not set in build-state.json metadata — deploy must record it via updateMetadata()';
      }
      try { new URL(state.metadata.deployUrl); } catch {
        return `deployUrl "${state.metadata.deployUrl}" is not a valid URL`;
      }
    } catch (e) {
      return `Cannot read build-state.json: ${e.message}`;
    }
    return null;
  },
  'phase-9': (projectPath, builderType) => {
    // Require ALL 3 QA result files + screenshot manifest + merged results
    const requiredResults = [
      { file: 'seo-qa-results.json', agent: 'seo-qa' },
      { file: 'design-review.json', agent: 'design-reviewer' },
      { file: 'image-qa-results.json', agent: 'image-qa' },
    ];

    for (const { file, agent } of requiredResults) {
      const filePath = path.join(projectPath, file);
      if (!fs.existsSync(filePath)) {
        return `${file} does not exist — ${agent} agent did not run`;
      }
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (typeof data.passed !== 'boolean') {
          return `${file} missing "passed" field — may be corrupt`;
        }
        if (data.agent !== agent) {
          return `${file} has agent="${data.agent}", expected "${agent}"`;
        }
      } catch (e) {
        return `${file} is invalid JSON: ${e.message}`;
      }
    }

    // Require screenshot manifest
    const manifestPath = path.join(projectPath, 'qa-screenshots', 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      return 'qa-screenshots/manifest.json does not exist — design-reviewer did not capture screenshots';
    }
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      if (!manifest.screenshots || manifest.screenshots.length === 0) {
        return 'Screenshot manifest has no entries';
      }
      const successful = manifest.screenshots.filter(s => s.status === 'ok');
      if (successful.length === 0) {
        return 'No successful screenshots in manifest';
      }
    } catch (e) {
      return `qa-screenshots/manifest.json is invalid: ${e.message}`;
    }

    // Require merged qa-results.json (created by validate-qa.mjs)
    const mergedPath = path.join(projectPath, 'qa-results.json');
    if (!fs.existsSync(mergedPath)) {
      return 'qa-results.json does not exist — run validate-qa.mjs to merge results';
    }

    return null;
  },
};

/** Read and validate build-state.json */
export function getBuildState(projectPath) {
  const filePath = path.join(projectPath, BUILD_STATE_FILE);
  if (!fs.existsSync(filePath)) {
    return { exists: false, error: `${BUILD_STATE_FILE} not found at ${filePath}` };
  }
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const result = BuildState.safeParse(raw);
  if (!result.success) {
    return { exists: true, valid: false, error: `Invalid build-state.json: ${result.error.message}` };
  }
  return { exists: true, valid: true, state: result.data };
}

/** Initialize build-state.json */
export function initBuildState(projectPath, buildId, builderType, metadata = {}) {
  if (!fs.existsSync(projectPath)) {
    fs.mkdirSync(projectPath, { recursive: true });
  }
  const state = createInitialState(buildId, builderType, projectPath, metadata);
  const filePath = path.join(projectPath, BUILD_STATE_FILE);
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
  return state;
}

/** Check if a required phase is completed, including artifact validation */
export function checkGate(projectPath, requiredPhaseId) {
  const result = getBuildState(projectPath);
  if (!result.exists) return { passed: false, reason: result.error };
  if (!result.valid) return { passed: false, reason: result.error };

  const { state } = result;
  const phase = state.phases[requiredPhaseId];
  if (!phase) return { passed: false, reason: `Unknown phase: ${requiredPhaseId}` };
  if (phase.status !== 'completed') {
    return { passed: false, reason: `${requiredPhaseId} status is "${phase.status}", expected "completed"` };
  }

  // Run artifact checks if defined
  const artifactCheck = ARTIFACT_CHECKS[requiredPhaseId];
  if (artifactCheck) {
    const artifactError = artifactCheck(projectPath, state.builderType);
    if (artifactError) {
      return { passed: false, reason: `${requiredPhaseId} artifacts invalid: ${artifactError}` };
    }
  }

  return { passed: true };
}

/** Check that ALL phases up to (and including) a given phase are completed */
export function checkAllGates(projectPath, upToPhaseId) {
  const result = getBuildState(projectPath);
  if (!result.exists) return { passed: false, reason: result.error };
  if (!result.valid) return { passed: false, reason: result.error };

  const idx = PHASE_IDS.indexOf(upToPhaseId);
  if (idx === -1) return { passed: false, reason: `Unknown phase: ${upToPhaseId}` };

  const failures = [];
  for (let i = 0; i <= idx; i++) {
    const gate = checkGate(projectPath, PHASE_IDS[i]);
    if (!gate.passed) failures.push(gate.reason);
  }

  if (failures.length > 0) {
    return { passed: false, reason: `Gate failures:\n  - ${failures.join('\n  - ')}` };
  }
  return { passed: true };
}

/** Mark a phase as completed — runs artifact checks first to prevent false completions */
export function completePhase(projectPath, phaseId, artifacts = {}, { skipArtifactCheck = false } = {}) {
  const result = getBuildState(projectPath);
  if (!result.exists || !result.valid) throw new Error(result.error);

  // Run artifact validation before allowing completion (unless explicitly skipped)
  if (!skipArtifactCheck) {
    const artifactCheck = ARTIFACT_CHECKS[phaseId];
    if (artifactCheck) {
      const artifactError = artifactCheck(projectPath, result.state.builderType);
      if (artifactError) {
        throw new Error(`Cannot complete ${phaseId} — artifact check failed: ${artifactError}`);
      }
    }
  }

  const state = result.state;
  state.phases[phaseId] = {
    status: 'completed',
    completedAt: new Date().toISOString(),
    artifacts,
  };

  const filePath = path.join(projectPath, BUILD_STATE_FILE);
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
  return state;
}

/** Mark a phase as failed */
export function failPhase(projectPath, phaseId, errorMessage) {
  const result = getBuildState(projectPath);
  if (!result.exists || !result.valid) throw new Error(result.error);

  const state = result.state;
  state.phases[phaseId] = {
    status: 'failed',
    error: errorMessage,
  };

  const filePath = path.join(projectPath, BUILD_STATE_FILE);
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
  return state;
}

/** Mark a phase as in_progress */
export function startPhase(projectPath, phaseId) {
  const result = getBuildState(projectPath);
  if (!result.exists || !result.valid) throw new Error(result.error);

  const state = result.state;
  state.phases[phaseId] = { status: 'in_progress' };

  const filePath = path.join(projectPath, BUILD_STATE_FILE);
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
  return state;
}

/** Update metadata (e.g., deployUrl after deploy) */
export function updateMetadata(projectPath, updates) {
  const result = getBuildState(projectPath);
  if (!result.exists || !result.valid) throw new Error(result.error);

  const state = result.state;
  Object.assign(state.metadata, updates);

  const filePath = path.join(projectPath, BUILD_STATE_FILE);
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
  return state;
}

/** Reset a single phase back to pending */
export function resetPhase(projectPath, phaseId) {
  const result = getBuildState(projectPath);
  if (!result.exists || !result.valid) throw new Error(result.error);

  const state = result.state;
  if (!state.phases[phaseId]) throw new Error(`Unknown phase: ${phaseId}`);

  state.phases[phaseId] = { status: 'pending' };

  const filePath = path.join(projectPath, BUILD_STATE_FILE);
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
  return state;
}

/** Reset all phases from a given phase onwards back to pending */
export function resetPhasesFrom(projectPath, fromPhaseId) {
  const result = getBuildState(projectPath);
  if (!result.exists || !result.valid) throw new Error(result.error);

  const state = result.state;
  const fromIdx = PHASE_IDS.indexOf(fromPhaseId);
  if (fromIdx === -1) throw new Error(`Unknown phase: ${fromPhaseId}`);

  const resetPhases = [];
  for (let i = fromIdx; i < PHASE_IDS.length; i++) {
    state.phases[PHASE_IDS[i]] = { status: 'pending' };
    resetPhases.push(PHASE_IDS[i]);
  }

  const filePath = path.join(projectPath, BUILD_STATE_FILE);
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
  return { state, resetPhases };
}

/** Print a summary of the build state */
export function printStatus(projectPath) {
  const result = getBuildState(projectPath);
  if (!result.exists) {
    console.error(`No build state found at ${projectPath}`);
    return;
  }
  if (!result.valid) {
    console.error(`Invalid build state: ${result.error}`);
    return;
  }

  const { state } = result;
  console.log(`\nBuild: ${state.buildId}`);
  console.log(`Type: ${state.builderType}`);
  console.log(`Started: ${state.startedAt}`);
  console.log(`Company: ${state.metadata.companyName || 'N/A'}`);
  console.log(`\nPhase Status:`);

  const labels = {
    'phase-0': 'Health Check',
    'phase-1': 'Data Gathering',
    'phase-2': 'Design Direction',
    'phase-3': 'Project Scaffold',
    'phase-4': 'Content/Config',
    'phase-5': 'Theme/Locations',
    'phase-6': 'Images/Components',
    'phase-7a': 'Fast Build',
    'phase-7b': 'Fast Deploy',
    'phase-7': 'Full Build',
    'phase-8': 'Deploy (final)',
    'phase-9': 'QA Verification',
    'phase-10': 'Learn',
  };

  for (const id of PHASE_IDS) {
    const p = state.phases[id];
    const icon = p.status === 'completed' ? '✓' : p.status === 'failed' ? '✗' : p.status === 'in_progress' ? '→' : '○';
    const label = labels[id] || id;
    const extra = p.error ? ` (${p.error})` : '';
    console.log(`  ${icon} ${id}: ${label} [${p.status}]${extra}`);
  }
  console.log('');
}

// --- CLI (only when executed directly, not when imported) ---
const isDirectExecution = process.argv[1]?.endsWith('phase-gate.mjs');
if (isDirectExecution && process.argv.slice(2).length > 0) {
  const args = process.argv.slice(2);
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const val = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : 'true';
      flags[key] = val;
      if (val !== 'true') i++;
    }
  }

  const projectPath = flags.project || process.cwd();

  if (flags.init) {
    const buildId = flags['build-id'] || `build-${Date.now()}`;
    const builderType = flags.builder || 'template';
    const metadata = {};
    if (flags.company) metadata.companyName = flags.company;
    if (flags.niche) metadata.niche = flags.niche;
    initBuildState(projectPath, buildId, builderType, metadata);
    console.log(`Initialized build state: ${buildId} (${builderType})`);
    process.exit(0);
  }

  if (flags.check) {
    const requires = flags.requires;
    if (!requires) {
      console.error('--requires <phase-id> is required');
      process.exit(1);
    }
    const gate = checkGate(projectPath, requires);
    if (gate.passed) {
      console.log(`Gate passed: ${requires}`);
      process.exit(0);
    } else {
      console.error(`Gate FAILED: ${gate.reason}`);
      process.exit(1);
    }
  }

  if (flags['check-all']) {
    const upTo = flags['up-to'];
    if (!upTo) {
      console.error('--up-to <phase-id> is required');
      process.exit(1);
    }
    const gate = checkAllGates(projectPath, upTo);
    if (gate.passed) {
      console.log(`All gates passed through ${upTo}`);
      process.exit(0);
    } else {
      console.error(`Gates FAILED:\n${gate.reason}`);
      process.exit(1);
    }
  }

  if (flags.complete) {
    const phase = flags.phase;
    if (!phase) {
      console.error('--phase <phase-id> is required');
      process.exit(1);
    }
    let artifacts = {};
    if (flags.artifacts) {
      try { artifacts = JSON.parse(flags.artifacts); } catch { artifacts = {}; }
    }
    try {
      completePhase(projectPath, phase, artifacts);
      console.log(`Phase completed: ${phase}`);
      process.exit(0);
    } catch (err) {
      console.error(`Phase completion REJECTED: ${err.message}`);
      process.exit(1);
    }
  }

  if (flags.fail) {
    const phase = flags.phase;
    const error = flags.error || 'Unknown error';
    if (!phase) {
      console.error('--phase <phase-id> is required');
      process.exit(1);
    }
    failPhase(projectPath, phase, error);
    console.error(`Phase failed: ${phase} — ${error}`);
    process.exit(1);
  }

  if (flags.start) {
    const phase = flags.phase;
    if (!phase) {
      console.error('--phase <phase-id> is required');
      process.exit(1);
    }
    startPhase(projectPath, phase);
    console.log(`Phase started: ${phase}`);
    process.exit(0);
  }

  if (flags.status) {
    printStatus(projectPath);
    process.exit(0);
  }

  if (flags.reset) {
    const phase = flags.phase;
    const from = flags.from;

    if (from) {
      // Reset all phases from a given phase onwards
      const { resetPhases } = resetPhasesFrom(projectPath, from);
      console.log(`Reset phases: ${resetPhases.join(', ')}`);
      process.exit(0);
    } else if (phase) {
      // Reset a single phase
      resetPhase(projectPath, phase);
      console.log(`Reset phase: ${phase}`);
      process.exit(0);
    } else {
      console.error('--reset requires either --phase <phase-id> or --from <phase-id>');
      process.exit(1);
    }
  }

  console.error('Unknown command. Use --init, --check, --check-all, --complete, --fail, --start, --reset, or --status');
  process.exit(1);
}
