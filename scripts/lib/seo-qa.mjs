#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { buildLog } from './build-logger.mjs';

// ============================================================================
// seo-qa.mjs
// ============================================================================
// Deterministic SEO checks against a live deployed site.
// Fetches each page and validates title, meta, placeholders, links, images.
// Writes seo-qa-results.json and logs to BUILD-LOG.md.
//
// Usage:
//   node scripts/lib/seo-qa.mjs --project /path --url https://site.netlify.app --attempt 1
//
// Exit code: 0 = pass, 1 = errors found
// ============================================================================

const BANNED_PLACEHOLDERS = [
  'Lorem ipsum',
  'PLACEHOLDER',
  'TODO:',
  'REPLACE_ME',
  'Your Business Name',
  'example@email.com',
  '000-000-0000',
  'XXX-XXX-XXXX',
  'Service One',
  'Service Two',
  'Owner Name',
  '[Company',
  '[City',
  '[Service',
];

// --- Route discovery ---

/**
 * Extract all routes from site.config.ts
 * @param {string} projectPath
 * @returns {string[]}
 */
export function discoverRoutes(projectPath) {
  const configPath = path.join(projectPath, 'src', 'site.config.ts');
  if (!fs.existsSync(configPath)) return ['/'];

  const content = fs.readFileSync(configPath, 'utf-8');
  const routes = new Set(['/']);

  // Static pages from nav
  const hrefMatches = [...content.matchAll(/href:\s*["'](\/?[^"']+)["']/g)];
  for (const [, href] of hrefMatches) {
    const route = href.startsWith('/') ? href : `/${href}`;
    routes.add(route.endsWith('/') ? route : `${route}/`);
  }

  // Service pages from slugs
  const slugMatches = [...content.matchAll(/slug:\s*["']([^"']+)["']/g)];
  for (const [, slug] of slugMatches) {
    routes.add(`/services/${slug}/`);
  }

  // Area pages from location files
  const locationsDir = path.join(projectPath, 'src', 'content', 'locations');
  if (fs.existsSync(locationsDir)) {
    const files = fs.readdirSync(locationsDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const slug = file.replace(/\.json$/, '');
      routes.add(`/areas/${slug}/`);
    }
  }

  // Common static pages
  for (const p of ['/about/', '/contact/', '/services/', '/reviews/', '/privacy-policy/', '/terms-and-conditions/']) {
    routes.add(p);
  }

  return [...routes];
}

// --- Page checking ---

/**
 * Fetch a page and run all SEO checks
 * @param {string} deployUrl
 * @param {string} route
 * @param {string} projectPath
 * @returns {Promise<{errors: Array, warnings: Array, checks: number}>}
 */
async function checkPage(deployUrl, route, projectPath) {
  const url = `${deployUrl.replace(/\/$/, '')}${route}`;
  const errors = [];
  const warnings = [];
  let checks = 0;

  let html;
  let status;
  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
    status = res.status;
    html = await res.text();
  } catch (e) {
    return {
      errors: [{ page: route, check: 'http-fetch', detail: `Failed to fetch ${url}: ${e.message}` }],
      warnings: [],
      checks: 1,
    };
  }

  // HTTP status
  checks++;
  if (status !== 200) {
    errors.push({ page: route, check: 'http-status', detail: `HTTP ${status} (expected 200)` });
    return { errors, warnings, checks }; // can't check HTML if page doesn't load
  }

  // <title>
  checks++;
  const titleMatch = html.match(/<title>(.*?)<\/title>/is);
  if (!titleMatch || !titleMatch[1].trim()) {
    errors.push({ page: route, check: 'title', detail: 'Missing or empty <title> tag' });
  } else {
    // Title length warning
    checks++;
    const titleLen = titleMatch[1].trim().length;
    if (titleLen > 65) {
      warnings.push({ page: route, check: 'title-length', detail: `Title is ${titleLen} chars (recommended <= 65)` });
    }
  }

  // Meta description
  checks++;
  const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/is);
  if (!descMatch) {
    errors.push({ page: route, check: 'meta-description', detail: 'Missing meta description' });
  } else {
    checks++;
    const descLen = descMatch[1].trim().length;
    if (descLen < 120 || descLen > 160) {
      warnings.push({ page: route, check: 'description-length', detail: `Description is ${descLen} chars (recommended 120-160)` });
    }
  }

  // <h1>
  checks++;
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!h1Match) {
    errors.push({ page: route, check: 'h1', detail: 'Missing <h1> tag' });
  } else {
    const h1Text = h1Match[1].replace(/<[^>]+>/g, '').trim();

    // Homepage H1 must contain company name
    if (route === '/') {
      checks++;
      const configPath = path.join(projectPath, 'src', 'site.config.ts');
      if (fs.existsSync(configPath)) {
        const configContent = fs.readFileSync(configPath, 'utf-8');
        const nameMatch = configContent.match(/^\s*name:\s*["'](.+?)["']/m);
        if (nameMatch && !h1Text.toLowerCase().includes(nameMatch[1].toLowerCase())) {
          errors.push({ page: route, check: 'homepage-h1-company', detail: `Homepage H1 missing company name "${nameMatch[1]}". Found: "${h1Text}"` });
        }
      }
    }

    // Service page H1 must contain area name(s)
    if (route.startsWith('/services/') && route !== '/services/') {
      checks++;
      const configPath = path.join(projectPath, 'src', 'site.config.ts');
      if (fs.existsSync(configPath)) {
        const configContent = fs.readFileSync(configPath, 'utf-8');
        const cityMatch = configContent.match(/^\s*city:\s*["'](.+?)["']/m);
        const hasAreaName = cityMatch && h1Text.toLowerCase().includes(cityMatch[1].toLowerCase());
        // Also check for common area patterns like "in [Area]"
        const hasInPattern = /\bin\s+[A-Z]/i.test(h1Text);
        if (!hasAreaName && !hasInPattern) {
          errors.push({ page: route, check: 'service-h1-area', detail: `Service H1 missing area name(s). Should include 1-3 areas for local SEO. Found: "${h1Text}"` });
        }
      }
    }
  }

  // Placeholder text
  for (const p of BANNED_PLACEHOLDERS) {
    checks++;
    if (html.includes(p)) {
      errors.push({ page: route, check: 'placeholder', detail: `Contains placeholder: "${p}"` });
    }
  }

  // Duplicate header/footer
  checks++;
  const headerCount = (html.match(/<header[\s>]/gi) || []).length;
  if (headerCount > 1) {
    errors.push({ page: route, check: 'duplicate-header', detail: `${headerCount} <header> elements (expected 1)` });
  }

  checks++;
  const footerCount = (html.match(/<footer[\s>]/gi) || []).length;
  if (footerCount > 1) {
    errors.push({ page: route, check: 'duplicate-footer', detail: `${footerCount} <footer> elements (expected 1)` });
  }

  // Internal link trailing slashes
  const internalLinks = [...html.matchAll(/href=["'](\/[^"']*?)["']/g)].map(m => m[1]);
  for (const link of internalLinks) {
    if (link !== '/' && !link.endsWith('/') && !link.includes('.') && !link.includes('#')) {
      checks++;
      errors.push({ page: route, check: 'trailing-slash', detail: `Internal link missing trailing slash: ${link}` });
    }
  }

  // AggregateRating without reviews
  checks++;
  if (html.includes('aggregateRating') || html.includes('AggregateRating')) {
    const reviewsPath1 = path.join(projectPath, 'src', 'content', 'reviews.json');
    const reviewsPath2 = path.join(projectPath, 'reviews.json');
    if (!fs.existsSync(reviewsPath1) && !fs.existsSync(reviewsPath2)) {
      errors.push({ page: route, check: 'fake-schema', detail: 'AggregateRating found without reviews.json' });
    }
  }

  // OG tags
  checks++;
  if (!/<meta\s+property=["']og:title["']/i.test(html)) {
    warnings.push({ page: route, check: 'og-title', detail: 'Missing og:title' });
  }
  if (!/<meta\s+property=["']og:image["']/i.test(html)) {
    warnings.push({ page: route, check: 'og-image', detail: 'Missing og:image' });
  }

  // Canonical
  checks++;
  if (!/<link\s+rel=["']canonical["']/i.test(html)) {
    warnings.push({ page: route, check: 'canonical', detail: 'Missing canonical link' });
  }

  // Image src checks
  const imgSrcs = [...html.matchAll(/(?:src|srcset)=["']([^"'\s]+\.(png|jpg|jpeg|webp|avif|svg|gif))[^"']*["']/gi)]
    .map(m => m[1])
    .filter(src => src.startsWith('/') || src.startsWith('http'));

  const uniqueImgs = [...new Set(imgSrcs)];
  for (const src of uniqueImgs) {
    checks++;
    const imgUrl = src.startsWith('http') ? src : `${deployUrl.replace(/\/$/, '')}${src}`;
    try {
      const res = await fetch(imgUrl, { method: 'HEAD', signal: AbortSignal.timeout(10000) });
      if (res.status !== 200) {
        errors.push({ page: route, check: 'broken-image', detail: `Image returns ${res.status}: ${src}` });
      }
    } catch {
      errors.push({ page: route, check: 'broken-image', detail: `Image unreachable: ${src}` });
    }
  }

  return { errors, warnings, checks };
}

// --- Main ---

/**
 * Run full SEO QA across all pages
 * @param {string} projectPath
 * @param {string} deployUrl
 * @param {number} attemptNumber
 * @returns {Promise<object>}
 */
export async function runSeoQa(projectPath, deployUrl, attemptNumber = 1) {
  const log = buildLog(projectPath);
  log.info('seo-qa', `Starting SEO QA attempt ${attemptNumber} against ${deployUrl}`);

  const routes = discoverRoutes(projectPath);
  log.info('seo-qa', `Discovered ${routes.length} routes to check`);

  const allErrors = [];
  const allWarnings = [];
  let totalChecks = 0;

  for (const route of routes) {
    const { errors, warnings, checks } = await checkPage(deployUrl, route, projectPath);
    allErrors.push(...errors);
    allWarnings.push(...warnings);
    totalChecks += checks;

    const status = errors.length === 0 ? '  ✓' : '  ✗';
    console.log(`${status} ${route} (${errors.length} errors, ${warnings.length} warnings)`);
  }

  const passed = allErrors.length === 0;

  const result = {
    timestamp: new Date().toISOString(),
    deployUrl,
    attempt: attemptNumber,
    agent: 'seo-qa',
    summary: {
      pages: routes.length,
      checks: totalChecks,
      errors: allErrors.length,
      warnings: allWarnings.length,
    },
    passed,
    failures: allErrors,
    warnings: allWarnings,
  };

  // Write result file
  const resultPath = path.join(projectPath, 'seo-qa-results.json');
  fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));

  // Log summary
  const level = passed ? 'INFO' : 'ERROR';
  log[passed ? 'info' : 'error'](
    'seo-qa',
    `SEO QA attempt ${attemptNumber}: ${allErrors.length} errors, ${allWarnings.length} warnings across ${routes.length} pages`
  );

  return result;
}

// --- CLI ---

const isDirectExecution = process.argv[1]?.endsWith('seo-qa.mjs');
if (isDirectExecution) {
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
  const deployUrl = flags.url;
  const attempt = parseInt(flags.attempt || '1', 10);

  if (!deployUrl) {
    console.error('Usage: node seo-qa.mjs --project /path --url https://site.netlify.app [--attempt 1]');
    process.exit(1);
  }

  console.log(`\nSEO QA — ${deployUrl}\n`);

  runSeoQa(projectPath, deployUrl, attempt).then(result => {
    console.log(`\nPages: ${result.summary.pages} | Checks: ${result.summary.checks} | Errors: ${result.summary.errors} | Warnings: ${result.summary.warnings}`);
    console.log(result.passed ? '\nSEO QA PASSED' : '\nSEO QA FAILED');
    console.log(`Results: seo-qa-results.json`);
    process.exit(result.passed ? 0 : 1);
  });
}
