// ============================================================================
// fal-api.mjs
// ============================================================================
// FAL AI image generation for the build runner.
// Reads prompts from IMAGE-PROMPTS.md (generated per-build from
// BUSINESS-CONTEXT.md + IMAGE-PROMPT-REFERENCE.md rules).
//
// Model: fal-ai/nano-banana-pro (mandatory — never use flux/schnell)
// Requires: FAL_KEY env var
// ============================================================================

import { writeFileSync, existsSync, mkdirSync, readFileSync, statSync, readdirSync, rmSync } from 'node:fs';
import { join, basename } from 'node:path';
import { get as httpsGet } from 'node:https';
import { createWriteStream } from 'node:fs';
import { retry } from './runner-utils.mjs';

const FAL_QUEUE_URL = 'https://queue.fal.run/fal-ai/nano-banana-pro';

const NEGATIVE_PROMPT = 'text, words, letters, logos, watermark, signature, label, signage, blurry, low quality, cartoon, illustration, painting, drawing, face, portrait, selfie, person looking at camera';

// ---------------------------------------------------------------------------
// Image size presets
// ---------------------------------------------------------------------------

const IMAGE_SIZES = {
  card:    { width: 1024, height: 768 },   // 4:3 — service card thumbnails
  hero:    { width: 1920, height: 823 },   // 21:9 — page hero banners
  content: { width: 1200, height: 800 },   // 3:2 — service content images
  og:      { width: 1200, height: 630 },   // OG social sharing image
  about:   { width: 1024, height: 768 },   // 4:3 — about page image
  square:  { width: 1024, height: 1024 },  // 1:1 — fallback
};

// Map from IMAGE-PROMPTS.md meta labels to IMAGE_SIZES keys
const SIZE_ALIAS = {
  'card':    'card',
  'hero':    'hero',
  'content': 'content',
  'og':      'og',
  'about':   'about',
  'square':  'square',
};

function getFalKey() {
  const key = process.env.FAL_KEY;
  if (!key) {
    throw new Error('FAL_KEY environment variable is not set');
  }
  return key;
}

// ---------------------------------------------------------------------------
// Download image from URL to disk
// ---------------------------------------------------------------------------

function downloadImage(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    httpsGet(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close();
        downloadImage(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        file.close();
        reject(new Error(`HTTP ${response.statusCode} downloading image`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => { file.close(); resolve(dest); });
    }).on('error', (err) => { file.close(); reject(err); });
  });
}

// ---------------------------------------------------------------------------
// Generate a single image via FAL queue API (nano-banana-pro)
// ---------------------------------------------------------------------------

async function generateImage(prompt, outputPath, options = {}) {
  const { width = 1024, height = 768 } = options;
  const key = getFalKey();

  // Submit to queue
  const submitRes = await fetch(FAL_QUEUE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      negative_prompt: NEGATIVE_PROMPT,
      image_size: { width, height },
      num_images: 1,
      num_inference_steps: 30,
      guidance_scale: 7.5,
      enable_safety_checker: false,
    }),
  });

  if (!submitRes.ok) {
    const body = await submitRes.text();
    throw new Error(`FAL API error ${submitRes.status}: ${body}`);
  }

  const submitData = await submitRes.json();

  // Synchronous result (model may return immediately)
  if (submitData.images?.[0]?.url) {
    await downloadImage(submitData.images[0].url, outputPath);
    return outputPath;
  }

  // Queued — poll for result
  const requestId = submitData.request_id;
  if (!requestId) {
    throw new Error('FAL API returned neither images nor request_id');
  }

  const statusUrl = `${FAL_QUEUE_URL}/requests/${requestId}/status`;
  const resultUrl = `${FAL_QUEUE_URL}/requests/${requestId}`;

  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 10_000));

    const statusRes = await fetch(statusUrl, {
      headers: { 'Authorization': `Key ${key}` },
    });
    const status = await statusRes.json();

    if (status.status === 'COMPLETED') {
      const resultRes = await fetch(resultUrl, {
        headers: { 'Authorization': `Key ${key}` },
      });
      const result = await resultRes.json();
      if (!result.images?.[0]?.url) {
        throw new Error('FAL completed but no image URL in result');
      }
      await downloadImage(result.images[0].url, outputPath);
      return outputPath;
    }

    if (status.status === 'FAILED') {
      throw new Error(`FAL generation failed: ${status.error || 'unknown error'}`);
    }

    // Still IN_QUEUE or IN_PROGRESS — keep polling
  }

  throw new Error('FAL generation timed out after 5 minutes');
}

// ---------------------------------------------------------------------------
// Parse IMAGE-PROMPTS.md → map of slot → { prompt, sizeKey }
// ---------------------------------------------------------------------------
// Expected format:
//
// ### service-1 (card, 1024x768)
// ```
// The actual prompt text here...
// ```
//
// ### hero-alt (hero, 1920x823)
// ```
// The actual prompt text here...
// ```
// ---------------------------------------------------------------------------

export function parseImagePrompts(projectPath) {
  const mdPath = join(projectPath, 'IMAGE-PROMPTS.md');
  if (!existsSync(mdPath)) {
    throw new Error('IMAGE-PROMPTS.md not found in project root — generate it before running image generation');
  }
  const content = readFileSync(mdPath, 'utf-8');
  const prompts = {};

  // Match: ### slot-name (sizeLabel, WxH)
  // followed by a fenced code block with the prompt
  // Tolerant: allows blank lines between heading and fence, optional language tag on fence,
  // and normalizes \r\n to \n before parsing.
  const normalized = content.replace(/\r\n/g, '\n');
  const regex = /###\s+(\S+)\s+\(([^,)]+)(?:,\s*(\d+x\d+))?\)\s*\n+```[^\n]*\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(normalized)) !== null) {
    const slot = match[1].trim();
    const sizeLabel = match[2].trim().toLowerCase();
    const dimensions = match[3] || null; // e.g., "1024x768"
    const prompt = match[4].trim();

    // Resolve size: prefer label lookup, fall back to parsed dimensions
    let sizeKey = SIZE_ALIAS[sizeLabel] || null;
    let size = sizeKey ? IMAGE_SIZES[sizeKey] : null;

    if (!size && dimensions) {
      const [w, h] = dimensions.split('x').map(Number);
      if (w && h) size = { width: w, height: h };
    }

    // Default to card size if nothing matched
    if (!size) size = IMAGE_SIZES.card;

    prompts[slot] = { prompt, size, sizeLabel };
  }

  const count = Object.keys(prompts).length;
  if (count === 0) {
    throw new Error('IMAGE-PROMPTS.md was found but no prompts could be parsed — check format');
  }

  console.log(`  Parsed ${count} prompts from IMAGE-PROMPTS.md`);
  return prompts;
}

// ---------------------------------------------------------------------------
// Ensure service image folders exist for all services
// ---------------------------------------------------------------------------

export function ensureServiceImageFolders(projectPath, services) {
  const imagesBase = join(projectPath, 'src/assets/images');
  const servicesDir = join(imagesBase, 'services');

  // Create folders for each active service
  for (const service of services) {
    for (const placement of ['card', 'hero', 'content', 'gallery']) {
      mkdirSync(join(servicesDir, service.slug, placement), { recursive: true });
    }
  }

  // Clean up template default service folders that don't match actual services
  if (existsSync(servicesDir)) {
    const existing = readdirSync(servicesDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);
    const activeSlugs = new Set(services.map(s => s.slug));
    for (const dir of existing) {
      if (!activeSlugs.has(dir)) {
        rmSync(join(servicesDir, dir), { recursive: true, force: true });
        console.log(`    Removed template service folder: services/${dir}/`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Map IMAGE-PROMPTS.md slots to file output paths
// ---------------------------------------------------------------------------
// Slot naming convention in IMAGE-PROMPTS.md:
//   service-1, service-1-hero, service-1-content  (service images)
//   inner-hero, service-areas, home-hero           (brand/page images)
//   og-image                                       (OG social image)
// ---------------------------------------------------------------------------

function resolveOutputPath(slot, projectPath, services) {
  const imagesBase = join(projectPath, 'src/assets/images');

  // Service images: service-N, service-N-hero, service-N-content
  const serviceMatch = slot.match(/^service-(\d+)(-hero|-content)?$/);
  if (serviceMatch) {
    const idx = parseInt(serviceMatch[1], 10) - 1;
    const variant = serviceMatch[2] ? serviceMatch[2].slice(1) : 'card'; // "hero", "content", or "card"
    const service = services[idx];
    if (!service) return null;

    const dir = join(imagesBase, 'services', service.slug, variant);
    mkdirSync(dir, { recursive: true });
    return join(dir, `${service.slug}-${variant}.jpg`);
  }

  // Brand/page images
  const brandPaths = {
    'inner-hero':    join(imagesBase, 'inner-hero', 'inner-hero.jpg'),
    'hero-alt':      join(imagesBase, 'inner-hero', 'inner-hero.jpg'), // alias
    'service-areas': join(imagesBase, 'service-areas', 'service-areas.jpg'),
    'areas':         join(imagesBase, 'service-areas', 'service-areas.jpg'), // alias
    'home-hero':     join(imagesBase, 'home-hero', 'home-hero.jpg'),
    'about':         join(imagesBase, 'inner-hero', 'about.jpg'),
    'about-hero':    join(imagesBase, 'inner-hero', 'about-hero.jpg'),
    'contact-hero':  join(imagesBase, 'inner-hero', 'contact-hero.jpg'),
    'og-image':      join(projectPath, 'public', 'og-image.jpg'),
  };

  const resolved = brandPaths[slot];
  if (resolved) {
    mkdirSync(join(resolved, '..'), { recursive: true });
    return resolved;
  }

  // Unknown slot — place in generated/
  const generatedDir = join(imagesBase, 'generated');
  mkdirSync(generatedDir, { recursive: true });
  return join(generatedDir, `${slot}.jpg`);
}

// ---------------------------------------------------------------------------
// Generate all missing images for a build
// ---------------------------------------------------------------------------
// Reads prompts from IMAGE-PROMPTS.md. No hardcoded niche prompts.
// ---------------------------------------------------------------------------

export async function generateMissingImages(ctx) {
  const { projectPath, clientConfig, contentGenerated } = ctx;
  const services = contentGenerated?.services || [];

  // Ensure service folders exist
  ensureServiceImageFolders(projectPath, services);

  // Parse prompts from IMAGE-PROMPTS.md
  const promptMap = parseImagePrompts(projectPath);

  // Build task list from parsed prompts
  const tasks = [];
  for (const [slot, { prompt, size }] of Object.entries(promptMap)) {
    const output = resolveOutputPath(slot, projectPath, services);
    if (!output) {
      console.log(`    Warning: slot "${slot}" could not be mapped to a file path — skipping`);
      continue;
    }

    tasks.push({
      slot,
      filename: output.replace(projectPath + '/', ''),
      output,
      prompt,
      options: size,
    });
  }

  if (tasks.length === 0) {
    console.log('  No image tasks to generate.');
    return { generated: 0, skipped: 0, failed: 0 };
  }

  let generated = 0;
  let skipped = 0;
  let failed = 0;
  const generatedFiles = [];

  // Placeholder images from the template are tiny stubs (under 1KB).
  // Real generated images are 50KB+. Treat anything under 1KB as a placeholder.
  const PLACEHOLDER_MAX_BYTES = 1024;

  const toGenerate = [];
  for (const task of tasks) {
    if (existsSync(task.output)) {
      const fileSize = statSync(task.output).size;
      if (fileSize < PLACEHOLDER_MAX_BYTES) {
        console.log(`    Replace: ${task.filename} (placeholder — ${fileSize} bytes)`);
        toGenerate.push(task);
      } else {
        console.log(`    Skip: ${task.filename} (already exists — ${(fileSize / 1024).toFixed(0)}KB)`);
        skipped++;
        generatedFiles.push(task.filename);
      }
    } else {
      toGenerate.push(task);
    }
  }

  // -----------------------------------------------------------------------
  // Incremental manifest writer — saves progress after each successful image
  // so partial results survive crashes/failures
  // -----------------------------------------------------------------------
  const manifestPath = join(projectPath, 'generated-images-manifest.json');
  function writeManifest() {
    const total = generated + skipped + failed;
    const manifestData = {
      model: 'fal-ai/nano-banana-pro',
      endpoint: FAL_QUEUE_URL,
      generatedAt: new Date().toISOString(),
      promptSource: 'IMAGE-PROMPTS.md',
      stats: { generated, skipped, failed, total },
      files: generatedFiles,
    };
    writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2));
  }

  // Write initial manifest with skipped files (partial save on re-run)
  writeManifest();

  // -----------------------------------------------------------------------
  // Circuit breaker — if the first CIRCUIT_BREAKER_THRESHOLD consecutive
  // requests fail, FAL is likely down. Skip remaining to avoid wasting time.
  // -----------------------------------------------------------------------
  const CIRCUIT_BREAKER_THRESHOLD = 2;
  let consecutiveFailures = 0;
  let circuitBroken = false;

  if (toGenerate.length > 0) {
    console.log(`    Generating ${toGenerate.length} images in parallel (Promise.allSettled)...`);

    // Fire ALL requests simultaneously — do NOT convert to sequential
    // Each request uses retry() with 3 attempts and exponential backoff
    const results = await Promise.allSettled(
      toGenerate.map(async (task) => {
        // If circuit breaker tripped, skip immediately
        if (circuitBroken) {
          throw new Error('Circuit breaker: FAL unavailable — skipping');
        }

        console.log(`    Start: ${task.filename} [${task.options?.width || 1024}x${task.options?.height || 768}]`);
        await retry(
          () => generateImage(task.prompt, task.output, task.options),
          3,
          `FAL ${task.slot}`
        );
        console.log(`    Done: ${task.filename}`);
        return task.filename;
      })
    );

    for (let i = 0; i < results.length; i++) {
      if (results[i].status === 'fulfilled') {
        generated++;
        consecutiveFailures = 0;
        generatedFiles.push(toGenerate[i].filename);
        // Incremental save after each success
        writeManifest();
      } else {
        const errMsg = results[i].reason?.message || 'unknown error';
        console.error(`    Failed: ${toGenerate[i].filename} — ${errMsg}`);
        failed++;

        // Circuit breaker logic
        consecutiveFailures++;
        if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD && !circuitBroken) {
          circuitBroken = true;
          console.log(`\n    Circuit breaker tripped: ${consecutiveFailures} consecutive failures — FAL likely unavailable`);
          console.log(`    Remaining images will be skipped. Build continues with existing images.`);
        }

        // Incremental save after each failure too
        writeManifest();
      }
    }
  }

  const total = generated + skipped + failed;
  console.log(`\n  Image generation: ${generated} created, ${skipped} skipped, ${failed} failed (${total} total)`);
  if (circuitBroken) {
    console.log(`  NOTE: Circuit breaker was tripped — FAL was unavailable during this build`);
  }

  // Final manifest write
  writeManifest();
  console.log(`  Wrote generated-images-manifest.json (model: fal-ai/nano-banana-pro)`);

  return { generated, skipped, failed, circuitBroken };
}
