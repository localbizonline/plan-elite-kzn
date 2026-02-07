import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = resolve(__dirname, '..');
const TEMPLATE_ROOT = resolve(SCRIPTS_DIR, '..');
const TMP = join(TEMPLATE_ROOT, '.test-tmp-config');

// Read the template site.config.ts
const templateConfig = readFileSync(join(TEMPLATE_ROOT, 'src/site.config.ts'), 'utf-8');

// Sample client data
const clientData = {
  companyName: 'Test Plumbing Co',
  phone: '0215551234',
  whatsapp: '0215551234',
  email: 'test@example.com',
  ownerFirstName: 'John',
  ownerLastName: 'Smith',
  yearStarted: '2015',
  niche: 'Plumbing',
  primaryCity: 'Cape Town',
  website: 'https://testplumbing.co.za',
  address: {
    street: '10 Long Street',
    city: 'Cape Town',
    region: 'Western Cape',
    postalCode: '8001',
  },
  services: ['Plumbing', 'Drainage'],
};

const designTokens = {
  fonts: { display: 'Bebas Neue', body: 'Lato' },
  colors: {
    primary: '#2563EB',
    primaryLight: '#60A5FA',
    accent: '#DC2626',
    accentLight: '#F87171',
    background: '#FFFFFF',
    surface: '#F3F4F6',
    text: '#1F2937',
    muted: '#9CA3AF',
  },
};

function setupTmpProject() {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(join(TMP, 'src'), { recursive: true });
  writeFileSync(join(TMP, 'src/site.config.ts'), templateConfig, 'utf-8');
  writeFileSync(join(TMP, 'client-config.json'), JSON.stringify(clientData, null, 2), 'utf-8');
  writeFileSync(join(TMP, 'design-tokens.json'), JSON.stringify(designTokens, null, 2), 'utf-8');
}

function runPopulateConfig(extraArgs = '') {
  execSync(
    `node "${join(SCRIPTS_DIR, 'populate-config.mjs')}" --project "${TMP}" --data "${join(TMP, 'client-config.json')}" --design "${join(TMP, 'design-tokens.json')}" ${extraArgs}`,
    { encoding: 'utf-8', stdio: 'pipe' }
  );
}

describe('populate-config.mjs', () => {
  before(() => setupTmpProject());
  after(() => rmSync(TMP, { recursive: true, force: true }));

  it('should replace identity fields', () => {
    runPopulateConfig();
    const config = readFileSync(join(TMP, 'src/site.config.ts'), 'utf-8');

    assert.ok(config.includes('"Test Plumbing Co"'), 'Company name should be injected');
    assert.ok(config.includes('"test@example.com"'), 'Email should be injected');
    assert.ok(config.includes('"John Smith"'), 'Founder should be injected');
    assert.ok(config.includes('"2015"'), 'Year should be injected');
    assert.ok(config.includes('"Cape Town"'), 'City should be injected');
    assert.ok(!config.includes('"Your Business Name"'), 'Template default should be replaced');
    assert.ok(!config.includes('"Owner Name"'), 'Template default should be replaced');
  });

  it('should apply design tokens', () => {
    const config = readFileSync(join(TMP, 'src/site.config.ts'), 'utf-8');

    assert.ok(config.includes('"Bebas Neue"'), 'Display font should be applied');
    assert.ok(config.includes('"Lato"'), 'Body font should be applied');
    assert.ok(config.includes('"#2563EB"'), 'Primary color should be applied');
    assert.ok(config.includes('"#DC2626"'), 'Accent color should be applied');
  });

  it('should be idempotent — running twice produces identical output', () => {
    // First run already done, read result
    const firstRun = readFileSync(join(TMP, 'src/site.config.ts'), 'utf-8');

    // Run again
    runPopulateConfig();
    const secondRun = readFileSync(join(TMP, 'src/site.config.ts'), 'utf-8');

    assert.equal(firstRun, secondRun, 'Two runs with same data should produce identical output');
  });

  it('should update when data changes', () => {
    const firstRun = readFileSync(join(TMP, 'src/site.config.ts'), 'utf-8');

    // Write modified client data
    const modified = { ...clientData, companyName: 'Updated Plumbing Co', email: 'new@example.com' };
    writeFileSync(join(TMP, 'client-config.json'), JSON.stringify(modified, null, 2), 'utf-8');

    runPopulateConfig();
    const updatedRun = readFileSync(join(TMP, 'src/site.config.ts'), 'utf-8');

    assert.ok(updatedRun.includes('"Updated Plumbing Co"'), 'Should reflect new company name');
    assert.ok(updatedRun.includes('"new@example.com"'), 'Should reflect new email');
    assert.ok(!updatedRun.includes('"Test Plumbing Co"'), 'Old company name should be gone');
  });

  it('should create config-provenance.json', () => {
    assert.ok(existsSync(join(TMP, 'src/config-provenance.json')), 'Provenance file should exist');
    const provenance = JSON.parse(readFileSync(join(TMP, 'src/config-provenance.json'), 'utf-8'));
    assert.ok(provenance.fields.name, 'Should have name field provenance');
    assert.equal(provenance.fields.name.source, 'airtable', 'Name source should be airtable');
  });

  it('should create client-mapped.json', () => {
    assert.ok(existsSync(join(TMP, 'client-mapped.json')), 'Mapped data file should exist');
    const mapped = JSON.parse(readFileSync(join(TMP, 'client-mapped.json'), 'utf-8'));
    assert.ok(mapped.name, 'Should have name field');
    assert.ok(mapped.phone, 'Should have phone field');
  });
});
