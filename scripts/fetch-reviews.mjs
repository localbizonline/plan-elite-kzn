#!/usr/bin/env node
// ============================================================================
// fetch-reviews.mjs
// ============================================================================
// Fetches reviews from three sources (Airtable first, then Google/Hello Peter
// only if URLs are provided in Airtable). No search-by-name — URL-only for
// external platforms.
//
// Usage:
//   node scripts/fetch-reviews.mjs --project /path --data client-config.json
//   node scripts/fetch-reviews.mjs --project /path --check   (pre-flight only, no fetching)
//
// Requires env vars:
//   AIRTABLE_TOKEN             - Airtable Personal Access Token (required)
//   DATAFORSEO_LOGIN           - DataForSEO API login (optional — Google reviews)
//   DATAFORSEO_PASSWORD        - DataForSEO API password (optional — Google reviews)
//   FIRECRAWL_API_KEY          - Firecrawl API key (optional — Hello Peter)
//
// Output: reviews.json + REVIEWS.md in project root, src/content/reviews.json
// ============================================================================

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { buildLog } from './lib/build-logger.mjs';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i]?.replace(/^--/, '');
    if (!key) continue;
    // Boolean flags (no value following)
    if (key === 'check') {
      parsed[key] = true;
      continue;
    }
    const value = args[i + 1];
    if (key && value) {
      parsed[key] = value;
      i++; // skip the value
    }
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// Source 1: Airtable LPP Reviews
// ---------------------------------------------------------------------------

const AIRTABLE_BASE_ID = 'app7AZ1zHElQfR4EH';
const REVIEWS_TABLE_ID = 'tblNjKSr1hlGrTeBR';
const AIRTABLE_API = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${REVIEWS_TABLE_ID}`;

function getAirtableToken() {
  return process.env.AIRTABLE_TOKEN || null;
}

async function fetchAirtableReviews(recordId, companyName, token) {
  if (!token) {
    console.log('  AIRTABLE_TOKEN not set — skipping Airtable reviews');
    return null;
  }
  if (!recordId) {
    console.log('  No partner recordId — skipping Airtable reviews');
    return null;
  }

  console.log(`  Fetching Airtable reviews for partner ${recordId}...`);

  try {
    // Fetch all published reviews, then filter client-side by linked record ID.
    // We can't use ARRAYJOIN({Lead Gen Partners}) in a formula because Airtable
    // returns display values (names) not record IDs. Client-side filtering on
    // the Lead Gen Partners array (which contains record IDs in API responses)
    // is the reliable approach.
    const formula = `{Review Status}='publish'`;
    const fields = ['name', 'rating', 'Review', 'Title', 'created', 'Lead Gen Partners'];

    let allRecords = [];
    let offset = null;

    do {
      const params = new URLSearchParams({
        filterByFormula: formula,
        'sort[0][field]': 'created',
        'sort[0][direction]': 'desc',
        maxRecords: '100',
      });
      // Request only the fields we need
      for (const f of fields) {
        params.append('fields[]', f);
      }
      if (offset) params.set('offset', offset);

      const res = await fetch(`${AIRTABLE_API}?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const body = await res.text();
        console.log(`  Airtable API error ${res.status}: ${body}`);
        return null;
      }

      const data = await res.json();
      allRecords = allRecords.concat(data.records || []);
      offset = data.offset || null;
    } while (offset);

    // Filter client-side: only reviews whose Lead Gen Partners array includes our recordId
    const matched = allRecords.filter(r => {
      const partners = r.fields['Lead Gen Partners'];
      return Array.isArray(partners) && partners.includes(recordId);
    });

    console.log(`  Airtable: ${allRecords.length} total published reviews, ${matched.length} match partner ${recordId}`);

    if (matched.length === 0) {
      console.log('  No published reviews found in Airtable for this partner');
      return null;
    }

    const reviews = matched.map(r => {
      const f = r.fields;
      return {
        text: f['Review'] || '',
        rating: f['rating'] || 5,
        reviewerName: f['name'] || 'Customer',
        title: f['Title'] || '',
        date: f['created'] || '',
        platform: 'localpros',
      };
    });

    // Calculate aggregate
    const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
    const avgRating = Math.round((totalRating / reviews.length) * 10) / 10;

    return {
      business: {
        name: companyName,
        rating: avgRating,
        totalReviews: reviews.length,
      },
      reviews,
    };
  } catch (err) {
    console.log(`  Airtable reviews error: ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Source 2: Google Reviews via URL only (DataForSEO)
// ---------------------------------------------------------------------------

function getDataForSEOAuth() {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) return null;
  return Buffer.from(`${login}:${password}`).toString('base64');
}

/**
 * Resolve any Google Maps URL to its canonical full form.
 * Handles short URLs (maps.app.goo.gl), regional domains (maps.google.co.za),
 * search URLs, and any other format — all redirect to the canonical
 * google.com/maps/place/... URL which contains the business name.
 */
async function resolveGoogleMapsUrl(url) {
  if (!url) return url;

  // Already a canonical /maps/place/ URL with business name — skip resolution
  if (url.includes('google.com/maps/place/') && url.includes('/@')) return url;

  console.log('  Resolving Google Maps URL...');
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    const resolved = res.url;
    if (resolved && resolved !== url) {
      console.log(`  Resolved to: ${resolved.slice(0, 120)}...`);
      return resolved;
    }
  } catch (err) {
    console.log(`  URL resolution failed: ${err.message}`);
  }
  return url;
}

/**
 * Extract a Google Maps place_id from a URL.
 * Supports formats:
 *   https://www.google.com/maps/place/?q=place_id:ChIJ...
 *   https://maps.google.com/?cid=12345
 *   https://www.google.com/maps/place/Business+Name/@lat,lng,zoom/data=!...!1s0x...:0x...
 */
function extractPlaceId(googleMapsUrl) {
  if (!googleMapsUrl) return null;

  // Direct place_id in URL
  const placeIdMatch = googleMapsUrl.match(/place_id[=:]([A-Za-z0-9_-]+)/);
  if (placeIdMatch) return placeIdMatch[1];

  // CID format — not a place_id but we can use it
  const cidMatch = googleMapsUrl.match(/[?&]cid=(\d+)/);
  if (cidMatch) return null; // CID isn't supported by DataForSEO place_id endpoint

  return null;
}

/**
 * Extract the business name from a resolved Google Maps URL.
 * e.g. /maps/place/Robotic+Steelworks/@ → "Robotic Steelworks"
 */
function extractBusinessNameFromUrl(googleMapsUrl) {
  if (!googleMapsUrl) return null;
  const match = googleMapsUrl.match(/\/maps\/place\/([^/@]+)/);
  if (match) return decodeURIComponent(match[1].replace(/\+/g, ' '));
  return null;
}

async function fetchGoogleReviews(googleMapsUrl, city, companyName, auth) {
  if (!googleMapsUrl) {
    console.log('  No Google Maps URL in Airtable — skipping Google reviews');
    return null;
  }
  if (!auth) {
    console.log('  DataForSEO credentials not set — skipping Google reviews');
    return null;
  }

  console.log(`  Fetching Google reviews from: ${googleMapsUrl}`);

  // Resolve short URLs (maps.app.goo.gl) to full URLs
  const resolvedUrl = await resolveGoogleMapsUrl(googleMapsUrl);
  const placeId = extractPlaceId(resolvedUrl);

  // Try to extract business name from URL for keyword fallback
  const urlBusinessName = extractBusinessNameFromUrl(resolvedUrl);

  try {
    let postBody;

    if (placeId) {
      // Use place_id endpoint (most accurate)
      console.log(`  Using place_id: ${placeId}`);
      postBody = [{
        place_id: placeId,
        location_name: 'South Africa',
        language_name: 'English',
        depth: 15,
        sort_by: 'newest',
      }];
    } else {
      // Use business name from URL or company name as keyword
      const keyword = urlBusinessName || companyName;
      console.log(`  No place_id — using keyword: "${keyword}"`);
      postBody = [{
        keyword,
        location_name: 'South Africa',
        language_name: 'English',
        depth: 15,
        sort_by: 'newest',
      }];
    }

    const postRes = await fetch('https://api.dataforseo.com/v3/business_data/google/reviews/task_post', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(postBody),
    });

    if (!postRes.ok) {
      console.log(`  DataForSEO task post HTTP error: ${postRes.status}`);
      return null;
    }

    const postData = await postRes.json();
    if (postData.status_code !== 20000 || !postData.tasks?.[0]?.id) {
      console.log(`  DataForSEO task post failed: ${postData.status_message || 'unknown error'}`);
      return null;
    }

    const taskId = postData.tasks[0].id;
    console.log(`  Task created: ${taskId} — polling for results...`);

    // Poll (max 8 attempts, 10s apart = ~80s max wait)
    // Status codes: 20100=in progress, 40602=in queue — keep polling
    const STILL_PROCESSING = new Set([20100, 40602]);

    for (let attempt = 0; attempt < 8; attempt++) {
      await new Promise(r => setTimeout(r, 10_000));

      const getRes = await fetch(
        `https://api.dataforseo.com/v3/business_data/google/reviews/task_get/${taskId}`,
        { headers: { Authorization: `Basic ${auth}` } }
      );

      if (!getRes.ok) {
        console.log(`  DataForSEO poll error: HTTP ${getRes.status}`);
        continue;
      }

      const getData = await getRes.json();
      const task = getData.tasks?.[0];
      if (!task) continue;

      if (task.status_code === 20000 && task.result?.[0]) {
        const result = task.result[0];
        const reviews = (result.items || []).filter(i => i.type === 'google_reviews_search');

        return {
          business: {
            name: result.title || '',
            rating: result.rating?.value || null,
            totalReviews: result.reviews_count || 0,
            placeId: result.place_id || placeId,
          },
          reviews: reviews.map(r => ({
            text: r.review_text || '',
            rating: r.rating?.value || 0,
            reviewerName: r.profile_name || 'Anonymous',
            date: r.timestamp || '',
            timeAgo: r.time_ago || '',
            ownerResponse: r.owner_answer || null,
            platform: 'google',
          })),
        };
      }

      if (!STILL_PROCESSING.has(task.status_code)) {
        console.log(`  Task failed: ${task.status_code} — ${task.status_message}`);
        break;
      }
      console.log(`  Poll ${attempt + 1}/8: ${task.status_message}`);
    }

    console.log('  Google reviews task timed out');
    return null;
  } catch (err) {
    console.log(`  Google reviews error: ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Source 3: Hello Peter via URL only (Firecrawl)
// ---------------------------------------------------------------------------

async function fetchHelloPeterReviews(helloPeterUrl, companyName) {
  if (!helloPeterUrl) {
    console.log('  No Hello Peter URL in Airtable — skipping Hello Peter');
    return null;
  }

  const firecrawlKey = process.env.FIRECRAWL_API_KEY;
  if (!firecrawlKey) {
    console.log('  FIRECRAWL_API_KEY not set — skipping Hello Peter (JS-rendered site needs Firecrawl)');
    return null;
  }

  console.log(`  Scraping Hello Peter via Firecrawl: ${helloPeterUrl}`);

  try {
    const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${firecrawlKey}`,
      },
      body: JSON.stringify({
        url: helloPeterUrl,
        formats: ['markdown'],
        waitFor: 5000,
      }),
    });

    const data = await res.json();
    if (!data.success) {
      console.log(`  Firecrawl error: ${data.error || 'unknown'}`);
      return null;
    }

    const md = data.data?.markdown || '';
    if (!md || md.length < 50) {
      console.log('  Empty or minimal content from Firecrawl');
      return null;
    }

    // Parse rating: "1.18 \| 8,641\nReviews (Last 12 months)" or "4.5 | 32 Reviews"
    // Firecrawl escapes pipes as \| and may split across lines
    const ratingMatch = md.match(/([\d.]+)\s*\\?\|\s*([\d,]+)\s*\n?\s*Reviews/i);
    // Also try: "No reviews in last 12 months"
    const noReviews = md.includes('No reviews in last 12 months');

    if (noReviews) {
      console.log('  Hello Peter: No reviews in last 12 months');
      return null;
    }

    const rating = ratingMatch ? parseFloat(ratingMatch[1]) : null;
    const totalReviews = ratingMatch ? parseInt(ratingMatch[2].replace(/,/g, '')) : 0;

    if (!rating && totalReviews === 0) {
      console.log('  No Hello Peter rating/reviews found in scraped content');
      return null;
    }

    // Parse individual reviews from markdown
    const reviews = [];
    const reviewPattern = /\[([^\]]+)\]\(https:\/\/www\.hellopeter\.com\/profile\/[^)]+\)\n\n.*?\n\n(\d{1,2}\s+\w+\s+\d{4})[^\n]*\n\n#\s+([^\n]+)\n\n([\s\S]*?)(?:\n\nReply|$)/g;
    let match;
    while ((match = reviewPattern.exec(md)) !== null) {
      const [, author, date, title, text] = match;
      reviews.push({
        text: text.trim().slice(0, 500),
        rating: rating ? Math.round(rating) : 3,
        reviewerName: author.trim(),
        title: title.trim(),
        date,
        platform: 'hellopeter',
      });
      if (reviews.length >= 10) break;
    }

    console.log(`  Hello Peter: ${rating}/5 (${totalReviews} reviews, ${reviews.length} extracted)`);

    return {
      platform: 'hellopeter',
      url: helloPeterUrl,
      business: {
        name: companyName,
        rating,
        totalReviews,
      },
      reviews,
    };
  } catch (err) {
    console.log(`  Hello Peter error: ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Merge & output
// ---------------------------------------------------------------------------

function calculateCombinedRating(sources) {
  const entries = sources
    .filter(s => s?.business?.rating && s?.business?.totalReviews)
    .map(s => ({ rating: s.business.rating, count: s.business.totalReviews }));

  if (entries.length === 0) return null;
  const totalWeight = entries.reduce((sum, e) => sum + e.count, 0);
  const weightedSum = entries.reduce((sum, e) => sum + e.rating * e.count, 0);
  return Math.round((weightedSum / totalWeight) * 10) / 10;
}

function deduplicateReviews(allReviews) {
  // Prefer earlier entries (Airtable first). Deduplicate by normalised reviewer name.
  const seen = new Set();
  return allReviews.filter(r => {
    const key = (r.reviewerName || '').toLowerCase().trim();
    if (!key || key === 'customer' || key === 'anonymous') return true; // Don't dedup generic names
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildReviewsJson(airtableData, googleData, helloPeterData, companyName) {
  // Merge all reviews — Airtable first
  const allReviews = deduplicateReviews([
    ...(airtableData?.reviews || []),
    ...(googleData?.reviews || []).map(r => ({ ...r, platform: 'google' })),
    ...(helloPeterData?.reviews || []).map(r => ({ ...r, platform: 'hellopeter' })),
  ]);

  const testimonials = allReviews
    .filter(r => r.rating >= 4 && r.text && r.text.length > 20)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 6)
    .map(r => ({
      quote: r.text,
      author: r.reviewerName,
      rating: r.rating,
      platform: r.platform,
      date: r.date,
    }));

  const combinedRating = calculateCombinedRating(
    [airtableData, googleData, helloPeterData].filter(Boolean)
  );

  return {
    generatedAt: new Date().toISOString(),
    companyName,
    aggregateRating: {
      localpros: airtableData?.business?.rating || null,
      google: googleData?.business?.rating || null,
      helloPeter: helloPeterData?.business?.rating || null,
      combined: combinedRating,
    },
    reviewCounts: {
      localpros: airtableData?.business?.totalReviews || 0,
      google: googleData?.business?.totalReviews || 0,
      helloPeter: helloPeterData?.business?.totalReviews || 0,
      total:
        (airtableData?.business?.totalReviews || 0) +
        (googleData?.business?.totalReviews || 0) +
        (helloPeterData?.business?.totalReviews || 0),
    },
    links: {
      googleMaps: googleData?.business?.placeId
        ? `https://www.google.com/maps/place/?q=place_id:${googleData.business.placeId}`
        : null,
      helloPeter: helloPeterData?.url || null,
    },
    testimonials,
    allReviews: allReviews.slice(0, 30),
  };
}

function buildReviewsMd(airtableData, googleData, helloPeterData, companyName) {
  const date = new Date().toISOString().split('T')[0];
  let md = `# Reviews for ${companyName}\n\nGenerated: ${date}\n\n---\n\n`;

  // Local Pros section (Airtable)
  if (airtableData?.reviews?.length > 0) {
    md += `## Local Pros Reviews\n\n`;
    md += `**Rating:** ${airtableData.business.rating}/5 (${airtableData.business.totalReviews} reviews)\n\n`;
    for (const r of airtableData.reviews) {
      const stars = '\u2605'.repeat(Math.round(r.rating)) + '\u2606'.repeat(5 - Math.round(r.rating));
      md += `**${r.reviewerName}** — ${stars}`;
      if (r.title) md += ` — *${r.title}*`;
      md += `\n`;
      if (r.text) md += `> "${r.text}"\n\n`;
    }
    md += `---\n\n`;
  } else {
    md += `## Local Pros Reviews\n\n*No Local Pros reviews found for this partner.*\n\n---\n\n`;
  }

  // Google section
  if (googleData?.reviews?.length > 0) {
    md += `## Google Reviews\n\n`;
    md += `**Rating:** ${googleData.business.rating}/5 (${googleData.business.totalReviews} reviews)\n\n`;
    for (const r of googleData.reviews.slice(0, 10)) {
      const stars = '\u2605'.repeat(Math.round(r.rating)) + '\u2606'.repeat(5 - Math.round(r.rating));
      md += `**${r.reviewerName}** — ${stars} — ${r.timeAgo || r.date}\n`;
      if (r.text) md += `> "${r.text}"\n\n`;
    }
    md += `---\n\n`;
  } else {
    md += `## Google Reviews\n\n*No Google reviews fetched (no Google Maps URL provided or no reviews found).*\n\n---\n\n`;
  }

  // Hello Peter section
  if (helloPeterData?.business?.rating) {
    md += `## Hello Peter\n\n`;
    md += `**Rating:** ${helloPeterData.business.rating}/5 (${helloPeterData.business.totalReviews} reviews)\n`;
    md += `**URL:** ${helloPeterData.url}\n\n---\n\n`;
  } else {
    md += `## Hello Peter\n\n*No Hello Peter data (no URL provided or no profile found).*\n\n---\n\n`;
  }

  // Summary table
  md += `## Summary\n\n| Platform | Rating | Reviews |\n|----------|--------|---------|\n`;
  if (airtableData?.business?.rating) {
    md += `| Local Pros | ${airtableData.business.rating}/5 | ${airtableData.business.totalReviews} |\n`;
  }
  if (googleData?.business?.rating) {
    md += `| Google | ${googleData.business.rating}/5 | ${googleData.business.totalReviews} |\n`;
  }
  if (helloPeterData?.business?.rating) {
    md += `| Hello Peter | ${helloPeterData.business.rating}/5 | ${helloPeterData.business.totalReviews} |\n`;
  }

  return md;
}

// ---------------------------------------------------------------------------
// Pre-flight check
// ---------------------------------------------------------------------------

function preflightCheck(clientConfig) {
  const companyName = clientConfig.companyName || clientConfig.company_name || '';
  const recordId = clientConfig.recordId || '';
  const googleMapsUrl = clientConfig.googleMapsUrl || '';
  const helloPeterUrl = clientConfig.helloPeterUrl || '';

  console.log(`\n========================================`);
  console.log(`  REVIEW FETCH — PRE-FLIGHT CHECK`);
  console.log(`========================================`);
  console.log(`  Company: ${companyName || 'MISSING'}`);
  console.log(`----------------------------------------`);

  const ready = [];
  const missing = [];

  // Source 1: Airtable LPP Reviews
  if (recordId) {
    ready.push(`Airtable LPP Reviews (partner ${recordId})`);
  } else {
    missing.push('recordId — cannot match Airtable reviews to partner');
  }

  // Source 2: Google Reviews
  if (googleMapsUrl) {
    ready.push(`Google Reviews (${googleMapsUrl})`);
  } else {
    missing.push('Google Business Profile URL — will skip Google reviews');
  }

  // Source 3: Hello Peter
  if (helloPeterUrl) {
    ready.push(`Hello Peter (${helloPeterUrl})`);
  } else {
    missing.push('Hello Peter URL — will skip Hello Peter');
  }

  // Print results
  if (ready.length > 0) {
    console.log(`\n  READY (${ready.length} source${ready.length > 1 ? 's' : ''}):`);
    for (const s of ready) {
      console.log(`    ✓ ${s}`);
    }
  }

  if (missing.length > 0) {
    console.log(`\n  MISSING in Airtable (${missing.length}):`);
    for (const m of missing) {
      console.log(`    ✗ ${m}`);
    }
  }

  if (ready.length === 0) {
    console.log(`\n  ⚠ No review sources available — reviews will be empty.`);
    console.log(`    Add the missing fields in Airtable before running.`);
  }

  console.log(`\n========================================\n`);

  return { ready, missing, canFetch: ready.length > 0 };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { project, data, check } = parseArgs();

  if (!project) {
    console.error('Usage: node fetch-reviews.mjs --project /path --data client-config.json');
    console.error('       node fetch-reviews.mjs --project /path --check');
    process.exit(1);
  }

  const projectPath = resolve(project);
  const log = buildLog(projectPath);

  // Load client config
  const configPath = data ? resolve(projectPath, data) : resolve(projectPath, 'client-config.json');
  if (!existsSync(configPath)) {
    console.error(`Client config not found: ${configPath}`);
    log.skip('fetch-reviews', 'Client config not found — skipping review collection');
    process.exit(0); // Non-blocking
  }

  let clientConfig;
  try {
    clientConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
  } catch (err) {
    console.error(`Failed to parse client config: ${err.message}`);
    log.error('fetch-reviews', `Failed to parse ${configPath}: ${err.message}`);
    process.exit(0); // Non-blocking
  }
  const companyName = clientConfig.companyName || clientConfig.company_name || 'Unknown';
  const recordId = clientConfig.recordId || '';
  const city = clientConfig.primaryCity || clientConfig.city || '';
  const googleMapsUrl = clientConfig.googleMapsUrl || '';
  const helloPeterUrl = clientConfig.helloPeterUrl || '';

  // --- Pre-flight check (always runs) ---
  const preflight = preflightCheck(clientConfig);

  if (check) {
    // --check mode: report and exit without fetching
    process.exit(preflight.canFetch ? 0 : 1);
  }

  // --- Source 1: Airtable LPP Reviews ---
  const airtableToken = getAirtableToken();
  const airtableData = await fetchAirtableReviews(recordId, companyName, airtableToken);

  if (airtableData) {
    console.log(`  Airtable: ${airtableData.business.rating}/5 (${airtableData.business.totalReviews} reviews)`);
    log.info('fetch-reviews', `Airtable reviews: ${airtableData.business.rating}/5 (${airtableData.business.totalReviews} reviews)`);
  } else {
    log.skip('fetch-reviews', `No Airtable reviews found for partner ${recordId || '(no recordId)'}`);
  }

  // --- Source 2: Google Reviews (URL only) ---
  const auth = getDataForSEOAuth();
  const googleData = await fetchGoogleReviews(googleMapsUrl, city, companyName, auth);

  if (googleData) {
    console.log(`  Google: ${googleData.business.rating}/5 (${googleData.business.totalReviews} reviews, ${googleData.reviews.length} fetched)`);
    log.info('fetch-reviews', `Google reviews: ${googleData.business.rating}/5 (${googleData.business.totalReviews} total, ${googleData.reviews.length} fetched)`);
  } else {
    log.skip('fetch-reviews', `No Google reviews fetched — ${googleMapsUrl ? 'lookup failed' : 'no Google Maps URL in Airtable'}`);
  }

  // --- Source 3: Hello Peter (URL only, via Firecrawl) ---
  const helloPeterData = await fetchHelloPeterReviews(helloPeterUrl, companyName);

  if (helloPeterData) {
    console.log(`  Hello Peter: ${helloPeterData.business.rating}/5 (${helloPeterData.business.totalReviews} reviews)`);
    log.info('fetch-reviews', `Hello Peter: ${helloPeterData.business.rating}/5 (${helloPeterData.business.totalReviews} reviews)`);
  } else {
    log.skip('fetch-reviews', `No Hello Peter data — ${helloPeterUrl ? 'lookup failed' : 'no Hello Peter URL in Airtable'}`);
  }

  // --- Generate output ---
  const reviewsJson = buildReviewsJson(airtableData, googleData, helloPeterData, companyName);
  const reviewsMd = buildReviewsMd(airtableData, googleData, helloPeterData, companyName);

  writeFileSync(join(projectPath, 'reviews.json'), JSON.stringify(reviewsJson, null, 2));
  writeFileSync(join(projectPath, 'REVIEWS.md'), reviewsMd);

  // Also write src/content/reviews.json in the format site.config.ts and
  // schema.org components expect (name, text, rating, date, source).
  const contentReviewsDir = join(projectPath, 'src/content');
  if (existsSync(contentReviewsDir)) {
    const contentReviews = (reviewsJson.testimonials || []).map(t => ({
      name: t.author || 'Customer',
      text: t.quote || '',
      rating: t.rating || 5,
      date: t.date || new Date().toISOString().split('T')[0],
      source: t.platform || 'google',
    }));
    writeFileSync(
      join(contentReviewsDir, 'reviews.json'),
      JSON.stringify(contentReviews, null, 2),
      'utf-8'
    );
    console.log(`  src/content/reviews.json created (${contentReviews.length} reviews)`);
  }

  console.log(`\nOutput written:`);
  console.log(`  ${join(projectPath, 'reviews.json')}`);
  console.log(`  ${join(projectPath, 'REVIEWS.md')}`);
  console.log(`  Total testimonials: ${reviewsJson.testimonials.length}`);
  console.log(`  Combined rating: ${reviewsJson.aggregateRating.combined || 'N/A'}`);

  log.info('fetch-reviews', `Reviews collected: LP=${airtableData?.business?.totalReviews || 0}, Google=${googleData?.business?.rating || 'N/A'}, HP=${helloPeterData?.business?.rating || 'N/A'}, ${reviewsJson.testimonials.length} testimonials`);
}

main().catch(err => {
  console.error('Review collection failed:', err.message);
  process.exit(0); // Non-blocking — reviews are optional
});
