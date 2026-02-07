// ============================================================================
// deploy.mjs
// ============================================================================
// GitHub + Netlify deployment wrapper for the build runner.
//
// Flow:
//   1. Create a private GitHub repo (via `gh` CLI) and push code
//   2. Create a Netlify site (with --account-slug to avoid interactive prompts)
//   3. Link Netlify to GitHub via updateSite API (continuous deployment)
//   4. Initial manual deploy so the site is live immediately
//   5. Future git pushes trigger automatic Netlify rebuilds
//
// Requires:
//   - `gh` CLI authenticated (run `gh auth login` first)
//   - Netlify CLI authenticated (`netlify login`)
//   - netlify.toml in the project root (included in template)
// ============================================================================

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

// Netlify account slug — used for non-interactive site creation
const NETLIFY_ACCOUNT_SLUG = 'localbizonline';

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Sanitize a string for safe use in shell commands (allow only alphanumeric, hyphens, underscores, dots). */
function shellSafe(str) {
  return str.replace(/[^a-zA-Z0-9._-]/g, '');
}

function run(cmd, opts) {
  return execSync(cmd, { encoding: 'utf-8', timeout: 60_000, stdio: 'pipe', ...opts });
}

/**
 * Initialize a git repo, commit all files, and push to a new GitHub repo.
 * @param {string} projectPath
 * @param {string} repoName - GitHub repo name (slug)
 * @returns {string} GitHub repo URL
 */
function pushToGitHub(projectPath, repoName) {
  const opts = { cwd: projectPath };

  // Initialize git if not already a repo
  if (!existsSync(join(projectPath, '.git'))) {
    console.log('  Initializing git repo...');
    run('git init', opts);
  }

  // Stage and commit all files
  console.log('  Staging and committing files...');
  run('git add -A', opts);
  try {
    run('git commit -m "Initial build — automated website deployment"', opts);
  } catch (err) {
    const msg = err.stderr || err.stdout || err.message || '';
    if (!msg.includes('nothing to commit')) {
      throw err;
    }
    console.log('  All files already committed');
  }

  // Ensure we're on main branch
  try {
    run('git branch -M main', opts);
  } catch {
    // Already on main
  }

  // Create GitHub repo (private) and push in one command
  console.log(`  Creating GitHub repo: ${repoName}...`);
  let repoUrl;
  try {
    const safeRepo = shellSafe(repoName);
    const output = run(
      `gh repo create ${safeRepo} --private --source . --remote origin --push`,
      { ...opts, timeout: 120_000 }
    );
    const urlMatch = output.match(/https:\/\/github\.com\/[^\s]+/);
    repoUrl = urlMatch ? urlMatch[0] : null;
  } catch (err) {
    const msg = err.stderr || err.stdout || err.message || '';
    if (msg.includes('already exists')) {
      console.log(`  Repo ${repoName} already exists — pushing to existing repo`);
      const safeRepo = shellSafe(repoName);
      const ghUser = run('gh api user -q .login', opts).trim();
      const remoteUrl = `https://github.com/${ghUser}/${safeRepo}.git`;
      try {
        run(`git remote add origin ${remoteUrl}`, opts);
      } catch {
        run(`git remote set-url origin ${remoteUrl}`, opts);
      }
      run('git push -u origin main --force-with-lease', { ...opts, timeout: 120_000 });
    } else {
      throw new Error(`GitHub repo creation failed: ${msg.slice(0, 500)}`);
    }
  }

  // Get the repo URL if we don't have it yet
  if (!repoUrl) {
    try {
      repoUrl = run('gh repo view --json url -q .url', opts).trim();
    } catch {
      repoUrl = `https://github.com/${repoName}`;
    }
  }

  console.log(`  GitHub repo: ${repoUrl}`);
  return repoUrl;
}

/**
 * Create a Netlify site, link it to the GitHub repo, and do an initial deploy.
 * @param {string} projectPath
 * @param {string} siteName - Netlify site slug
 * @param {string} repoUrl - GitHub repo URL (e.g. https://github.com/owner/repo)
 * @returns {string} Deploy URL
 */
function createAndLinkNetlifySite(projectPath, siteName, repoUrl) {
  const opts = { cwd: projectPath, env: { ...process.env } };

  // Step 1: Create the Netlify site (--account-slug avoids interactive team prompt)
  console.log(`  Creating Netlify site: ${siteName}...`);
  let siteId;
  try {
    const output = run(
      `npx netlify-cli sites:create --name ${siteName} --account-slug ${NETLIFY_ACCOUNT_SLUG}`,
      { ...opts, timeout: 30_000 }
    );
    // Extract site ID from output (it prints "Project ID: xxx")
    const idMatch = output.match(/Project ID:\s*([a-f0-9-]+)/i) || output.match(/Site ID:\s*([a-f0-9-]+)/i);
    if (idMatch) {
      siteId = idMatch[1];
    }
    console.log(`  Netlify site created: ${siteName}`);
  } catch (err) {
    const msg = err.stderr || err.stdout || err.message || '';
    if (msg.includes('already exists') || msg.includes('409') || msg.includes('slug already taken')) {
      console.log(`  Netlify site ${siteName} already exists`);
    } else {
      console.log(`  Site creation note: ${msg.slice(0, 200)}`);
    }
  }

  // Get the site ID if we don't have it yet
  if (!siteId) {
    try {
      const siteInfo = run(
        `npx netlify-cli api getSite --data '{"site_id": "${siteName}.netlify.app"}'`,
        { ...opts, timeout: 30_000 }
      );
      const parsed = JSON.parse(siteInfo);
      siteId = parsed.id;
    } catch {
      console.log('  Could not retrieve site ID — will attempt deploy without linking');
    }
  }

  // Step 2: Link Netlify to GitHub repo via updateSite API
  // This sets continuous deployment — pushes to main trigger Netlify builds
  if (siteId) {
    const repoMatch = repoUrl.match(/github\.com\/([^/]+\/[^/\s]+)/);
    const repoPath = repoMatch ? repoMatch[1].replace(/\.git$/, '') : null;

    if (repoPath) {
      console.log(`  Linking Netlify to GitHub (${repoPath})...`);
      try {
        const payload = JSON.stringify({
          site_id: siteId,
          body: {
            repo: {
              provider: 'github',
              repo: repoPath,
              repo_branch: 'main',
              cmd: 'npm run build',
              dir: 'dist',
            },
          },
        });
        run(`npx netlify-cli api updateSite --data '${payload}'`, {
          ...opts, timeout: 30_000,
        });
        console.log('  Continuous deployment configured — pushes to main auto-deploy');
      } catch (err) {
        const msg = err.stderr || err.stdout || err.message || '';
        console.log(`  GitHub linking note: ${msg.slice(0, 200)}`);
        console.log('  Site created but not linked to GitHub — you can link manually in Netlify dashboard');
      }
    }
  }

  // Step 3: Initial manual deploy so the site is live immediately
  // (GitHub-triggered build may take a moment to start)
  console.log('  Running initial deploy...');
  let deployUrl = `https://${siteName}.netlify.app`;
  try {
    const output = run(
      `npx netlify-cli deploy --prod --dir dist --json`,
      { ...opts, timeout: 180_000 }
    );
    const json = JSON.parse(output);
    deployUrl = json.ssl_url || json.deploy_url || json.url || deployUrl;
  } catch (err) {
    const errMsg = err.stderr || err.stdout || err.message || '';
    // Non-fatal — the GitHub webhook will trigger a build
    console.log(`  Initial deploy note: ${errMsg.slice(0, 200)}`);
    console.log('  Site will deploy automatically when Netlify processes the GitHub webhook');
  }

  return deployUrl;
}

/**
 * Deploy a built Astro site via GitHub → Netlify (continuous deployment).
 *
 * Flow:
 *   1. Push code to a private GitHub repo
 *   2. Create Netlify site linked to the GitHub repo
 *   3. Initial manual deploy for instant availability
 *   4. Future pushes to main auto-deploy via Netlify
 *
 * @param {string} projectPath - Path to the project with dist/ directory
 * @param {string} companyName - Company name (used to derive site slug)
 * @returns {Promise<{deployUrl: string, repoUrl: string}>} URLs
 */
export async function deployToNetlify(projectPath, companyName) {
  const siteName = slugify(companyName);

  // Step 1: Push to GitHub
  console.log('\n  === Step 1: Push to GitHub ===');
  const repoUrl = pushToGitHub(projectPath, siteName);

  // Step 2: Create Netlify site, link to GitHub, initial deploy
  console.log('\n  === Step 2: Create Netlify Site + Link to GitHub ===');
  const deployUrl = createAndLinkNetlifySite(projectPath, siteName, repoUrl);

  console.log('\n  === Deployment Complete ===');
  console.log(`  Live site:   ${deployUrl}`);
  console.log(`  GitHub:      ${repoUrl}`);
  console.log(`  Auto-deploy: Pushes to main → Netlify rebuilds automatically`);

  return { deployUrl, repoUrl };
}
