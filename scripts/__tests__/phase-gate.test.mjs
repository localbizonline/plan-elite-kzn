import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = resolve(__dirname, '..');

const {
  initBuildState,
  getBuildState,
  startPhase,
  completePhase,
  failPhase,
  resetPhase,
  resetPhasesFrom,
  checkGate,
  updateMetadata,
} = await import(join(SCRIPTS_DIR, 'lib/phase-gate.mjs'));

const TEMPLATE_ROOT = resolve(SCRIPTS_DIR, '..');
const TMP = join(TEMPLATE_ROOT, '.test-tmp-gate');

describe('phase-gate.mjs', () => {
  before(() => {
    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(TMP, { recursive: true });
  });

  after(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  beforeEach(() => {
    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(TMP, { recursive: true });
  });

  it('should initialize build state with all phases pending', () => {
    initBuildState(TMP, 'test-build-1', 'template', { companyName: 'Test Co' });

    const result = getBuildState(TMP);
    assert.ok(result.exists, 'Build state should exist');
    assert.ok(result.valid, 'Build state should be valid');
    assert.equal(result.state.buildId, 'test-build-1');
    assert.equal(result.state.builderType, 'template');
    assert.equal(result.state.metadata.companyName, 'Test Co');

    // All phases should be pending
    for (const [id, phase] of Object.entries(result.state.phases)) {
      assert.equal(phase.status, 'pending', `${id} should be pending`);
    }
  });

  it('should complete a phase', () => {
    initBuildState(TMP, 'test-build-2', 'template');

    // phase-0 has no artifact checks, so it should complete fine
    completePhase(TMP, 'phase-0', {}, { skipArtifactCheck: true });

    const result = getBuildState(TMP);
    assert.equal(result.state.phases['phase-0'].status, 'completed');
    assert.ok(result.state.phases['phase-0'].completedAt);
  });

  it('should fail a phase', () => {
    initBuildState(TMP, 'test-build-3', 'template');
    failPhase(TMP, 'phase-1', 'Airtable API error');

    const result = getBuildState(TMP);
    assert.equal(result.state.phases['phase-1'].status, 'failed');
    assert.equal(result.state.phases['phase-1'].error, 'Airtable API error');
  });

  it('should start a phase (in_progress)', () => {
    initBuildState(TMP, 'test-build-4', 'template');
    startPhase(TMP, 'phase-2');

    const result = getBuildState(TMP);
    assert.equal(result.state.phases['phase-2'].status, 'in_progress');
  });

  it('should reset a single phase', () => {
    initBuildState(TMP, 'test-build-5', 'template');
    completePhase(TMP, 'phase-0', {}, { skipArtifactCheck: true });

    assert.equal(getBuildState(TMP).state.phases['phase-0'].status, 'completed');

    resetPhase(TMP, 'phase-0');
    assert.equal(getBuildState(TMP).state.phases['phase-0'].status, 'pending');
  });

  it('should reset phases from a given phase onwards', () => {
    initBuildState(TMP, 'test-build-6', 'template');
    completePhase(TMP, 'phase-0', {}, { skipArtifactCheck: true });
    completePhase(TMP, 'phase-1', {}, { skipArtifactCheck: true });
    completePhase(TMP, 'phase-2', {}, { skipArtifactCheck: true });

    const { resetPhases } = resetPhasesFrom(TMP, 'phase-1');
    assert.ok(resetPhases.includes('phase-1'));
    assert.ok(resetPhases.includes('phase-2'));

    const result = getBuildState(TMP);
    assert.equal(result.state.phases['phase-0'].status, 'completed', 'phase-0 should stay completed');
    assert.equal(result.state.phases['phase-1'].status, 'pending', 'phase-1 should be reset');
    assert.equal(result.state.phases['phase-2'].status, 'pending', 'phase-2 should be reset');
  });

  it('should update metadata', () => {
    initBuildState(TMP, 'test-build-7', 'template');
    updateMetadata(TMP, { deployUrl: 'https://test.netlify.app', templateVersion: '1.0.0' });

    const result = getBuildState(TMP);
    assert.equal(result.state.metadata.deployUrl, 'https://test.netlify.app');
    assert.equal(result.state.metadata.templateVersion, '1.0.0');
  });

  it('should check gate for pending phase', () => {
    initBuildState(TMP, 'test-build-8', 'template');
    const gate = checkGate(TMP, 'phase-0');
    assert.equal(gate.passed, false, 'Pending phase should not pass gate');
  });

  it('should check gate for completed phase without artifacts', () => {
    initBuildState(TMP, 'test-build-9', 'template');
    completePhase(TMP, 'phase-0', {}, { skipArtifactCheck: true });
    const gate = checkGate(TMP, 'phase-0');
    assert.equal(gate.passed, true, 'Completed phase-0 should pass gate');
  });

  it('should reject phase-1 completion without client-config.json', () => {
    initBuildState(TMP, 'test-build-10', 'template');

    assert.throws(() => {
      completePhase(TMP, 'phase-1');
    }, /client-config.json does not exist/);
  });

  it('should pass phase-1 gate with client-config.json', () => {
    initBuildState(TMP, 'test-build-11', 'template');
    writeFileSync(join(TMP, 'client-config.json'), '{}', 'utf-8');
    completePhase(TMP, 'phase-1');

    const gate = checkGate(TMP, 'phase-1');
    assert.equal(gate.passed, true);
  });

  it('should report error when build-state.json is missing', () => {
    const emptyDir = join(TMP, 'empty');
    mkdirSync(emptyDir, { recursive: true });

    const result = getBuildState(emptyDir);
    assert.equal(result.exists, false);
  });
});
