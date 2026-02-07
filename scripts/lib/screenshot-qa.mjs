#!/usr/bin/env node
// ============================================================================
// screenshot-qa.mjs
// ============================================================================
// Takes full-page screenshots of deployed pages using Playwright.
// Outputs screenshots to {projectPath}/qa-screenshots/ for visual review.
//
// Usage:
//   node scripts/lib/screenshot-qa.mjs --project /path --url https://site.netlify.app --pages "/,/about/,/contact/,/services/"
//
// Requires: npx playwright (auto-installs chromium if needed)
// ============================================================================

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

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

async function takeScreenshots(projectPath, deployUrl, pages) {
  const screenshotDir = join(projectPath, 'qa-screenshots');
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

  const results = [];

  // Generate a Playwright script that takes all screenshots
  const playwrightScript = `
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = [];

  const pages = ${JSON.stringify(pages)};
  const deployUrl = ${JSON.stringify(deployUrl)};
  const screenshotDir = ${JSON.stringify(screenshotDir)};

  for (const route of pages) {
    const slug = route === '/' ? 'home' : route.replace(/^\/|\/$/g, '').replace(/\\//g, '-');
    const url = deployUrl + route;

    try {
      // Desktop screenshot (1440px)
      const desktopCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const desktopPage = await desktopCtx.newPage();
      await desktopPage.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await desktopPage.waitForTimeout(1000); // Let fonts/images load
      const desktopPath = screenshotDir + '/' + slug + '-desktop.png';
      await desktopPage.screenshot({ path: desktopPath, fullPage: true });
      await desktopCtx.close();

      // Mobile screenshot (375px)
      const mobileCtx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true });
      const mobilePage = await mobileCtx.newPage();
      await mobilePage.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await mobilePage.waitForTimeout(1000);
      const mobilePath = screenshotDir + '/' + slug + '-mobile.png';
      await mobilePage.screenshot({ path: mobilePath, fullPage: true });
      await mobileCtx.close();

      results.push({ route, slug, desktop: desktopPath, mobile: mobilePath, status: 'ok' });
      console.log('  ✓ ' + route + ' (desktop + mobile)');
    } catch (err) {
      results.push({ route, slug, status: 'error', error: err.message });
      console.error('  ✗ ' + route + ': ' + err.message);
    }
  }

  await browser.close();

  // Write results manifest
  const fs = require('fs');
  fs.writeFileSync(
    screenshotDir + '/manifest.json',
    JSON.stringify({ deployUrl, timestamp: new Date().toISOString(), screenshots: results }, null, 2)
  );

  console.log('\\nScreenshots saved to: ' + screenshotDir);
  console.log('Total: ' + results.filter(r => r.status === 'ok').length + '/' + results.length + ' pages captured');
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
  const manifestPath = join(screenshotDir, 'manifest.json');
  if (existsSync(manifestPath)) {
    return JSON.parse(readFileSync(manifestPath, 'utf-8'));
  }
  return { screenshots: [] };
}

// CLI entry
const args = parseArgs();
if (!args.project || !args.url) {
  console.error('Usage: node screenshot-qa.mjs --project /path --url https://site.netlify.app --pages "/,/about/"');
  process.exit(1);
}

const pages = (args.pages || '/').split(',').map(p => p.trim());
takeScreenshots(args.project, args.url, pages).then(result => {
  console.log(`\nCapture complete: ${result.screenshots?.length || 0} pages`);
});
