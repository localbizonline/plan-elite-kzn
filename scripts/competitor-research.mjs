#!/usr/bin/env node
// ============================================================================
// competitor-research.mjs
// ============================================================================
// Takes homepage screenshots of competitor websites using Playwright.
// Called by the competitor-researcher teammate after it searches + filters URLs.
//
// Usage:
//   node scripts/competitor-research.mjs --project /path --urls "https://a.com,https://b.com" --labels "perth-1,perth-2"
//
// Also exports filtering logic for use by the teammate agent.
//
// Requires: npx playwright (auto-installs chromium if needed)
// ============================================================================

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

// ---------------------------------------------------------------------------
// Directory blocklist — domains that are directories/aggregators, not businesses
// ---------------------------------------------------------------------------
export const DIRECTORY_DOMAINS = [
  // Global directories
  'yelp.com', 'yellowpages.com', 'yellowpages.co.za', 'yellowpages.com.au',
  'hotfrog.com', 'hotfrog.co.za', 'hotfrog.com.au',
  'bark.com', 'thumbtack.com', 'angi.com', 'homeadvisor.com',
  'checkatrade.com', 'yell.com', 'trustpilot.com',
  'gumtree.com', 'gumtree.co.za', 'gumtree.com.au',
  'bbb.org', 'glassdoor.com', 'indeed.com',
  'nextdoor.com', 'manta.com', 'mapquest.com',

  // South Africa directories
  'snupit.co.za', 'cylex.co.za', 'yellosa.co.za',
  'sa-yp.co.za', 'brabys.com', 'showme.co.za', 'ananzi.co.za',

  // Australia directories
  'localsearch.com.au', 'truelocal.com.au', 'hipages.com.au',
  'servicecentral.com.au', 'oneflare.com.au', 'airtasker.com',
  'cylex.com.au', 'startlocal.com.au', 'hotfrog.com.au',
  'whereis.com', 'dlook.com.au',

  // USA directories
  'angieslist.com', 'porch.com', 'networx.com',
  'expertise.com', 'fixr.com', 'houzz.com',

  // Social media
  'facebook.com', 'instagram.com', 'linkedin.com', 'youtube.com',
  'tiktok.com', 'twitter.com', 'x.com', 'pinterest.com',
  'threads.net',

  // Other non-business sites
  'wikipedia.org', 'reddit.com', 'quora.com',
  'maps.google.com', 'google.com',
  'bing.com', 'yahoo.com',
];

// Patterns that indicate a directory/aggregator even if domain isn't in blocklist
const DIRECTORY_PATH_PATTERNS = [
  '/business-listing', '/directory', '/find-a-', '/search?',
  '/category/', '/listing/', '/profile/',
];

/**
 * Check if a URL belongs to a directory/aggregator site
 * @param {string} url
 * @returns {boolean} true if the URL should be excluded
 */
export function isDirectoryUrl(url) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^www\./, '');

    // Check exact domain match
    if (DIRECTORY_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d))) {
      return true;
    }

    // Check government/education domains
    if (/\.gov(\.[a-z]{2})?$/.test(hostname) || /\.edu(\.[a-z]{2})?$/.test(hostname)) {
      return true;
    }

    // Check path patterns
    const path = parsed.pathname.toLowerCase();
    if (DIRECTORY_PATH_PATTERNS.some(p => path.includes(p))) {
      return true;
    }

    return false;
  } catch {
    return true; // Invalid URL = exclude
  }
}

/**
 * Filter search results to only business websites
 * @param {Array<{url: string, title: string, description: string}>} results
 * @param {number} limit - max results to return
 * @returns {Array} filtered results
 */
export function filterToBusinessSites(results, limit = 2) {
  return results
    .filter(r => r.url && !isDirectoryUrl(r.url))
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Playwright screenshot capture
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace(/^--/, '');
    const value = args[i + 1];
    if (key && value) parsed[key] = value;
  }
  return parsed;
}

async function takeCompetitorScreenshots(projectPath, urls, labels) {
  const screenshotDir = join(projectPath, 'competitor-screenshots');
  mkdirSync(screenshotDir, { recursive: true });

  // Ensure Playwright browsers are installed
  try {
    execSync('npx playwright install chromium --with-deps 2>/dev/null || npx playwright install chromium', {
      stdio: 'pipe',
      timeout: 120_000,
    });
  } catch (e) {
    console.error('Failed to install Playwright browsers:', e.message);
    process.exit(1);
  }

  const playwrightScript = `
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  const urls = ${JSON.stringify(urls)};
  const labels = ${JSON.stringify(labels)};
  const screenshotDir = ${JSON.stringify(screenshotDir)};

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const label = labels[i] || ('site-' + (i + 1));

    try {
      const ctx = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });
      const page = await ctx.newPage();

      // Navigate with generous timeout — some small business sites are slow
      await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {
        // Fallback: try with just domcontentloaded
        return page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      });

      // Wait for fonts/images to settle
      await page.waitForTimeout(2000);

      // Dismiss common cookie/popup overlays
      try {
        const dismissSelectors = [
          '[class*="cookie"] button',
          '[class*="consent"] button',
          '[class*="popup"] [class*="close"]',
          '[aria-label="Close"]',
          '.modal-close',
        ];
        for (const sel of dismissSelectors) {
          const btn = await page.$(sel);
          if (btn) {
            await btn.click().catch(() => {});
            await page.waitForTimeout(500);
            break;
          }
        }
      } catch {} // Ignore overlay dismissal failures

      const screenshotPath = screenshotDir + '/' + label + '-desktop.png';
      await page.screenshot({ path: screenshotPath, fullPage: false }); // Viewport only, not full page

      // Extract basic design signals
      const designSignals = await page.evaluate(() => {
        const body = document.body;
        const computed = getComputedStyle(body);
        const hero = document.querySelector('header, [class*="hero"], [class*="banner"], section:first-of-type');
        const heroStyle = hero ? getComputedStyle(hero) : null;
        const cta = document.querySelector('a[class*="btn"], button[class*="btn"], a[class*="cta"], .btn-primary, .wp-block-button a');
        const ctaStyle = cta ? getComputedStyle(cta) : null;

        return {
          bodyBg: computed.backgroundColor,
          bodyFont: computed.fontFamily?.split(',')[0]?.replace(/['"]/g, ''),
          heroBg: heroStyle?.backgroundColor || null,
          ctaColor: ctaStyle?.backgroundColor || null,
          ctaText: ctaStyle?.color || null,
          h1Font: document.querySelector('h1') ? getComputedStyle(document.querySelector('h1')).fontFamily?.split(',')[0]?.replace(/['"]/g, '') : null,
          title: document.title,
        };
      }).catch(() => ({}));

      await ctx.close();

      results.push({
        url,
        label,
        screenshotPath: label + '-desktop.png',
        status: 'ok',
        designSignals,
        title: designSignals.title || url,
      });

      console.log('  OK ' + label + ' ← ' + url);
    } catch (err) {
      results.push({ url, label, status: 'error', error: err.message });
      console.error('  FAIL ' + label + ': ' + err.message);
    }
  }

  await browser.close();

  const fs = require('fs');
  fs.writeFileSync(
    screenshotDir + '/screenshot-manifest.json',
    JSON.stringify({ timestamp: new Date().toISOString(), screenshots: results }, null, 2)
  );

  console.log('\\nScreenshots saved to: ' + screenshotDir);
  console.log('Total: ' + results.filter(r => r.status === 'ok').length + '/' + results.length + ' captured');
})();
`;

  const scriptPath = join(screenshotDir, '_take-screenshots.cjs');
  writeFileSync(scriptPath, playwrightScript, 'utf-8');

  try {
    execSync(`node "${scriptPath}"`, {
      stdio: 'inherit',
      timeout: 300_000, // 5 min max
      cwd: projectPath,
    });
  } catch (e) {
    console.error('Screenshot capture failed:', e.message);
  }

  // Read manifest
  const manifestPath = join(screenshotDir, 'screenshot-manifest.json');
  if (existsSync(manifestPath)) {
    return JSON.parse(readFileSync(manifestPath, 'utf-8'));
  }
  return { screenshots: [] };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------
const args = parseArgs();
if (args.urls) {
  if (!args.project) {
    console.error('Usage: node competitor-research.mjs --project /path --urls "url1,url2" --labels "label1,label2"');
    process.exit(1);
  }

  const urls = args.urls.split(',').map(u => u.trim()).filter(Boolean);
  const labels = (args.labels || '').split(',').map(l => l.trim()).filter(Boolean);

  // Auto-generate labels if not provided
  const finalLabels = urls.map((_, i) => labels[i] || `site-${i + 1}`);

  console.log(`\nCompetitor Research — taking ${urls.length} screenshots...\n`);

  takeCompetitorScreenshots(args.project, urls, finalLabels).then(result => {
    console.log(`\nCapture complete: ${result.screenshots?.length || 0} sites`);
  });
}
