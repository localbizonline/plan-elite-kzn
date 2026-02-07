import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = resolve(__dirname, '..');
const TEMPLATE_ROOT = resolve(SCRIPTS_DIR, '..');
const TMP = join(TEMPLATE_ROOT, '.test-tmp-fal');

// Import the function we're testing
const { parseImagePrompts } = await import(join(SCRIPTS_DIR, 'lib/fal-api.mjs'));

describe('parseImagePrompts', () => {
  before(() => {
    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(TMP, { recursive: true });
  });

  after(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it('should parse standard format prompts', () => {
    const md = `# Image Prompts

### service-1 (card, 1024x768)
\`\`\`
A professional plumber working on pipes in a modern bathroom, natural lighting
\`\`\`

### hero-alt (hero, 1920x823)
\`\`\`
Wide-angle shot of a plumbing workshop with tools neatly arranged
\`\`\`

### og-image (og, 1200x630)
\`\`\`
Professional plumbing services branding image
\`\`\`
`;

    writeFileSync(join(TMP, 'IMAGE-PROMPTS.md'), md, 'utf-8');
    const prompts = parseImagePrompts(TMP);

    assert.equal(Object.keys(prompts).length, 3, 'Should parse 3 prompts');
    assert.ok(prompts['service-1'], 'Should have service-1 slot');
    assert.ok(prompts['hero-alt'], 'Should have hero-alt slot');
    assert.ok(prompts['og-image'], 'Should have og-image slot');

    // Check dimensions
    assert.equal(prompts['service-1'].size.width, 1024);
    assert.equal(prompts['service-1'].size.height, 768);
    assert.equal(prompts['hero-alt'].size.width, 1920);
    assert.equal(prompts['hero-alt'].size.height, 823);
    assert.equal(prompts['og-image'].size.width, 1200);
    assert.equal(prompts['og-image'].size.height, 630);

    // Check prompt content
    assert.ok(prompts['service-1'].prompt.includes('plumber'), 'Should contain prompt text');
  });

  it('should throw if IMAGE-PROMPTS.md is missing', () => {
    const emptyDir = join(TMP, 'empty');
    mkdirSync(emptyDir, { recursive: true });

    assert.throws(() => {
      parseImagePrompts(emptyDir);
    }, /IMAGE-PROMPTS.md not found/);
  });

  it('should throw if no prompts are parseable', () => {
    const badDir = join(TMP, 'bad');
    mkdirSync(badDir, { recursive: true });
    writeFileSync(join(badDir, 'IMAGE-PROMPTS.md'), '# No valid prompts here\n\nJust text.', 'utf-8');

    assert.throws(() => {
      parseImagePrompts(badDir);
    }, /no prompts could be parsed/);
  });

  it('should handle blank lines between heading and fence', () => {
    const md = `### service-2 (card, 1024x768)

\`\`\`
A clean kitchen with modern fixtures
\`\`\`
`;
    writeFileSync(join(TMP, 'IMAGE-PROMPTS.md'), md, 'utf-8');
    const prompts = parseImagePrompts(TMP);
    assert.equal(Object.keys(prompts).length, 1);
    assert.ok(prompts['service-2'].prompt.includes('kitchen'));
  });

  it('should fall back to card size for unknown labels', () => {
    const md = `### custom-slot (unknown-label, 1024x768)
\`\`\`
Some prompt text
\`\`\`
`;
    writeFileSync(join(TMP, 'IMAGE-PROMPTS.md'), md, 'utf-8');
    const prompts = parseImagePrompts(TMP);
    assert.equal(prompts['custom-slot'].size.width, 1024);
    assert.equal(prompts['custom-slot'].size.height, 768);
  });
});
