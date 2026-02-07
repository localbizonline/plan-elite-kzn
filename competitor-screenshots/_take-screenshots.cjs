
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  const urls = ["https://eliteconstructionusa.com/"];
  const labels = ["dallas-2"];
  const screenshotDir = "/Users/jeremymartin/Documents/Cursor/Websites/.build-staging/plan-elite-kzn/competitor-screenshots";

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

  console.log('\nScreenshots saved to: ' + screenshotDir);
  console.log('Total: ' + results.filter(r => r.status === 'ok').length + '/' + results.length + ' captured');
})();
