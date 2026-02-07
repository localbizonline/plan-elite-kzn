import fs from 'node:fs';
import path from 'node:path';

/** Scan HTML files in dist/ and run QA checks */
export function runStaticQA(projectPath) {
  const distPath = path.join(projectPath, 'dist');
  if (!fs.existsSync(distPath)) {
    return { passed: false, errors: ['dist/ directory does not exist'], warnings: [] };
  }

  const htmlFiles = findHtmlFiles(distPath);
  if (htmlFiles.length === 0) {
    return { passed: false, errors: ['No HTML files found in dist/'], warnings: [] };
  }

  const errors = [];
  const warnings = [];

  for (const file of htmlFiles) {
    const relPath = path.relative(distPath, file);
    const content = fs.readFileSync(file, 'utf-8');

    // Title tag
    if (!/<title>.+<\/title>/i.test(content)) {
      errors.push(`${relPath}: Missing <title> tag`);
    }

    // Meta description
    if (!/<meta\s+name=["']description["']/i.test(content)) {
      errors.push(`${relPath}: Missing meta description`);
    }

    // H1 tag
    if (!/<h1[\s>]/i.test(content)) {
      warnings.push(`${relPath}: Missing <h1> tag`);
    }

    // Duplicate headers
    const headerCount = (content.match(/<header[\s>]/gi) || []).length;
    if (headerCount > 1) {
      errors.push(`${relPath}: ${headerCount} <header> elements found (expected 1)`);
    }

    // Duplicate footers
    const footerCount = (content.match(/<footer[\s>]/gi) || []).length;
    if (footerCount > 1) {
      errors.push(`${relPath}: ${footerCount} <footer> elements found (expected 1)`);
    }

    // Placeholder text
    const placeholders = [
      'Lorem ipsum',
      'PLACEHOLDER',
      'TODO:',
      'REPLACE_ME',
      'Your Business Name',
      'example@email.com',
      '000-000-0000',
      'XXX-XXX-XXXX',
    ];
    for (const p of placeholders) {
      if (content.includes(p)) {
        errors.push(`${relPath}: Contains placeholder text: "${p}"`);
      }
    }

    // Internal links trailing slashes
    const internalLinks = [...content.matchAll(/href=["'](\/[^"']*?)["']/g)].map(m => m[1]);
    for (const link of internalLinks) {
      if (link !== '/' && !link.endsWith('/') && !link.includes('.') && !link.includes('#')) {
        warnings.push(`${relPath}: Internal link missing trailing slash: ${link}`);
      }
    }

    // Broken images (check src files exist in dist)
    const imgSrcs = [...content.matchAll(/src=["'](\/[^"']*?\.(png|jpg|jpeg|webp|svg|avif|gif))["']/gi)].map(m => m[1]);
    for (const src of imgSrcs) {
      const imgPath = path.join(distPath, src);
      if (!fs.existsSync(imgPath)) {
        errors.push(`${relPath}: Broken image: ${src}`);
      }
    }

    // Fake schema (aggregateRating without reviews.json)
    if (content.includes('aggregateRating')) {
      const reviewsPath = path.join(projectPath, 'src', 'content', 'reviews.json');
      const reviewsPathAlt = path.join(projectPath, 'reviews.json');
      if (!fs.existsSync(reviewsPath) && !fs.existsSync(reviewsPathAlt)) {
        errors.push(`${relPath}: aggregateRating in schema without reviews.json — remove or add real reviews`);
      }
    }
  }

  // Check for OG tags on homepage
  const indexFile = path.join(distPath, 'index.html');
  if (fs.existsSync(indexFile)) {
    const indexContent = fs.readFileSync(indexFile, 'utf-8');
    if (!/<meta\s+property=["']og:title["']/i.test(indexContent)) {
      warnings.push('index.html: Missing og:title');
    }
    if (!/<meta\s+property=["']og:description["']/i.test(indexContent)) {
      warnings.push('index.html: Missing og:description');
    }
    if (!/<meta\s+property=["']og:image["']/i.test(indexContent)) {
      warnings.push('index.html: Missing og:image');
    }
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
    stats: {
      pagesChecked: htmlFiles.length,
      errorCount: errors.length,
      warningCount: warnings.length,
    },
  };
}

/** Check source files for banned imports (BaseLayout rule) */
export function checkBannedImports(projectPath) {
  const pagesDir = path.join(projectPath, 'src', 'pages');
  if (!fs.existsSync(pagesDir)) return { passed: true, errors: [] };

  const errors = [];
  const bannedComponents = ['Header', 'Footer', 'MobileActionBar', 'QuoteModal'];
  const pageFiles = findFiles(pagesDir, '.astro');

  for (const file of pageFiles) {
    const relPath = path.relative(projectPath, file);
    const content = fs.readFileSync(file, 'utf-8');

    for (const comp of bannedComponents) {
      const importPattern = new RegExp(`import\\s+${comp}`, 'i');
      if (importPattern.test(content)) {
        errors.push(`${relPath}: Imports ${comp} directly — must use BaseLayout instead`);
      }
    }
  }

  return { passed: errors.length === 0, errors };
}

function findHtmlFiles(dir) {
  return findFiles(dir, '.html');
}

function findFiles(dir, ext) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findFiles(full, ext));
    } else if (entry.name.endsWith(ext)) {
      results.push(full);
    }
  }
  return results;
}

// CLI
const args = process.argv.slice(2);
if (args.length > 0) {
  let projectPath = process.cwd();
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--project' && args[i + 1]) { projectPath = args[i + 1]; i++; }
  }

  console.log('\nRunning Static QA...\n');

  const qa = runStaticQA(projectPath);
  const imports = checkBannedImports(projectPath);

  if (qa.errors.length > 0) {
    console.error('ERRORS:');
    for (const e of qa.errors) console.error(`  ✗ ${e}`);
  }
  if (imports.errors.length > 0) {
    console.error('\nBANNED IMPORTS:');
    for (const e of imports.errors) console.error(`  ✗ ${e}`);
  }
  if (qa.warnings.length > 0) {
    console.log('\nWARNINGS:');
    for (const w of qa.warnings) console.log(`  ⚠ ${w}`);
  }

  console.log(`\nPages checked: ${qa.stats.pagesChecked}`);
  console.log(`Errors: ${qa.stats.errorCount + imports.errors.length}`);
  console.log(`Warnings: ${qa.stats.warningCount}`);

  const allPassed = qa.passed && imports.passed;
  console.log(allPassed ? '\nQA PASSED' : '\nQA FAILED');
  process.exit(allPassed ? 0 : 1);
}
