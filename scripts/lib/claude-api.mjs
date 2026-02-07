// ============================================================================
// claude-api.mjs
// ============================================================================
// Uses Claude Code CLI for the 3 AI-dependent build phases:
//   Phase 2: Design Direction
//   Phase 4: Content Generation
//   Phase 9: QA Analysis
//
// Uses Claude Code CLI (already authenticated) instead of Anthropic SDK.
// No API key required - uses the user's existing Claude Code authentication.
// ============================================================================

import { execSync, spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, tmpdir } from 'node:os';

// ---------------------------------------------------------------------------
// Core Claude CLI call with JSON output
// ---------------------------------------------------------------------------

async function callClaudeCLI(prompt, options = {}) {
  const { maxRetries = 3, timeoutMs = 300_000 } = options;

  // Write prompt to temp file to avoid shell escaping issues
  const tmpDir = join(tmpdir(), 'build-runner');
  if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
  const promptFile = join(tmpDir, `prompt-${Date.now()}.txt`);
  writeFileSync(promptFile, prompt, 'utf-8');

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Use claude CLI with the prompt
      // The --print flag outputs just the response (no interactive UI)
      // We ask Claude to output JSON in the prompt itself
      const result = execSync(
        `claude --print --output-format text --dangerously-skip-permissions "$(cat ${JSON.stringify(promptFile)})"`,
        {
          encoding: 'utf-8',
          timeout: timeoutMs,
          maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large responses
          env: { ...process.env, TERM: 'dumb' }, // Disable color codes
          stdio: ['pipe', 'pipe', 'pipe'],
        }
      );

      // Extract JSON from the response
      // Claude might wrap the JSON in markdown code blocks
      let jsonStr = result.trim();

      // Try to extract JSON from markdown code block
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }

      // Try to find JSON object or array
      const jsonStart = jsonStr.indexOf('{');
      const jsonEnd = jsonStr.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        jsonStr = jsonStr.slice(jsonStart, jsonEnd + 1);
      }

      const parsed = JSON.parse(jsonStr);
      return parsed;
    } catch (err) {
      if (attempt === maxRetries - 1) {
        throw new Error(`Claude CLI failed after ${maxRetries} attempts: ${err.message}`);
      }

      const delay = Math.pow(2, attempt) * 2000 + Math.random() * 1000;
      console.log(`  Claude CLI retry ${attempt + 1}/${maxRetries} in ${(delay / 1000).toFixed(0)}s: ${err.message}`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// ---------------------------------------------------------------------------
// Phase 2: Design Direction
// ---------------------------------------------------------------------------

export async function generateDesignDirection(clientConfig) {
  // Load recently used designs to avoid repetition
  const knowledgePath = join(homedir(), '.claude/knowledge/successes/design-decisions.json');
  let recentFonts = [];
  let recentDirections = [];
  if (existsSync(knowledgePath)) {
    try {
      const data = JSON.parse(readFileSync(knowledgePath, 'utf-8'));
      recentFonts = (data.recentlyUsed?.fonts || []).slice(0, 5);
      recentDirections = (data.recentlyUsed?.directions || []).slice(0, 3);
    } catch { /* ignore parse errors */ }
  }

  const prompt = `You are a bold, opinionated brand designer for South African local service business websites.
You create distinctive visual identities — never generic, never safe. Each design must feel intentional and specific to the business niche.

Create a unique visual identity for this business:

**Business:** ${clientConfig.companyName}
**Niche:** ${clientConfig.niche}
**City:** ${clientConfig.primaryCity || 'South Africa'}
**Features:** ${(clientConfig.differentiators || []).join(', ') || 'None specified'}
**Year Started:** ${clientConfig.yearStarted || 'Unknown'}

## Design Direction Rules
- Choose ONE direction: Industrial, Brutalist, Organic, Playful, or Minimalist
- DO NOT reuse these directions (recently used): ${recentDirections.join(', ') || 'none'}
- The direction must match the niche personality

## Font Rules
- Display font: a Google Font for uppercase headings. Bold, distinctive.
- Body font: a Google Font optimised for readability at body sizes.
- DO NOT reuse these display fonts (recently used): ${recentFonts.join(', ') || 'none'}
- DO NOT use generic fonts: Arial, Helvetica, Times New Roman, Georgia, Verdana, Tahoma, Trebuchet MS

## Color Rules
- Primary: dark, authoritative colour (navy, charcoal, forest green, deep burgundy, etc.)
- Primary Light: lighter shade of primary (for hover states, overlays)
- Accent: MUST be a completely different hue from primary. Must provide WCAG 3:1 contrast against primary. Think: orange accent on navy primary, gold on forest green, coral on dark gray.
- Accent Light: lighter shade of accent
- Background: light colour in the #F5-#FA range
- Surface: white or near-white
- Text: dark, readable — same as or similar to primary
- Muted: medium gray for secondary text (#6B-#8B range)
- All values as 6-digit hex codes with # prefix

## Reasoning
Explain in 2-3 sentences why this direction, font pairing, and colour palette suit this specific business.

RESPOND WITH ONLY A JSON OBJECT (no markdown, no explanation outside the JSON):
{
  "direction": "Industrial|Brutalist|Organic|Playful|Minimalist",
  "fonts": {
    "display": "Google Font family name",
    "body": "Google Font family name"
  },
  "colors": {
    "primary": "#XXXXXX",
    "primaryLight": "#XXXXXX",
    "accent": "#XXXXXX",
    "accentLight": "#XXXXXX",
    "background": "#XXXXXX",
    "surface": "#XXXXXX",
    "text": "#XXXXXX",
    "muted": "#XXXXXX"
  },
  "reasoning": "Your explanation here"
}`;

  console.log('  Calling Claude CLI for design direction...');
  const result = await callClaudeCLI(prompt);

  console.log(`  Direction: ${result.direction}`);
  console.log(`  Fonts: ${result.fonts.display} / ${result.fonts.body}`);
  console.log(`  Primary: ${result.colors.primary}, Accent: ${result.colors.accent}`);
  console.log(`  Reasoning: ${result.reasoning}`);

  return result;
}

// ---------------------------------------------------------------------------
// Phase 4: Content Generation
// ---------------------------------------------------------------------------

export async function generateContent(clientConfig, designTokens) {
  const niche = clientConfig.niche || 'Service';
  const city = clientConfig.primaryCity || 'South Africa';
  const company = clientConfig.companyName || 'Business';
  const owner = [clientConfig.ownerFirstName, clientConfig.ownerLastName].filter(Boolean).join(' ') || 'Owner';
  const year = clientConfig.yearStarted || '2020';

  const prompt = `You are a professional copywriter for South African local service business websites.
Write in South African English: use "geyser" not "water heater", "tap" not "faucet", "flat" not "apartment", "metre" not "meter", "colour" not "color", "neighbour" not "neighbor".
Be specific, authoritative, and conversion-focused. No placeholder text. No filler.
The business is ${company} — ${niche} services in ${city}.

Generate all website content for ${company}.

## Business Context
- **Niche:** ${niche}
- **City:** ${city}
- **Owner:** ${owner}
- **Year Started:** ${year}
- **Services (raw from Airtable):** ${(clientConfig.services || []).join(', ') || 'Not specified'}
- **Features/Differentiators:** ${(clientConfig.differentiators || []).join(', ') || 'Not specified'}
- **About (from client):** ${clientConfig.aboutText || 'Not provided — generate from context'}
- **Services text (from client):** ${clientConfig.servicesText || 'Not provided — generate from context'}
- **Service areas:** ${clientConfig.serviceAreas || city}
- **Design direction:** ${designTokens?.direction || 'Professional'}

## Content Rules
1. Max 6 service pages (2–6 is common). Group related services into categories if needed.
2. Each service needs: title, slug (kebab-case), description (2-3 sentences), shortDescription (1 sentence), exactly 4 features, exactly 3 FAQs with question+answer, heroSubtitle (1 sentence), longDescription (2-3 paragraphs), 3 whatWeCover items (title+description), 2 whyChooseUs items (bold+text)
3. Homepage: metaTitle (<60 chars), metaDescription (120-160 chars), heroTitle (short, punchy), heroSubtitle, 3 heroBadges (short trust signals), whyChooseTitle, whyChooseSubtitle, 6 whyChooseCards (title+description), 3-5 FAQs
4. About: metaTitle (<60 chars), metaDescription, heroTitle, heroSubtitle, heading, 3-5 paragraphs, badge (short trust text), 4 stats (value+label, e.g. "15+" / "Years Experience")
5. Contact: metaTitle (<60 chars), metaDescription, heroTitle, heroSubtitle, 2-3 FAQs about contacting/booking
6. Reviews: metaTitle, metaDescription, sourceSummary (1 sentence about where reviews come from)
7. ServicesPage: metaTitle, metaDescription, heroTitle, heroSubtitle
8. WhatsApp message: a short greeting mentioning ${niche}
9. Legal: servicesList (array of all services offered)
10. Use ${company} and ${city} in meta titles
11. Reference ${year} in about content (established since...)
12. Use ${owner} in about content

RESPOND WITH ONLY A JSON OBJECT (no markdown, no explanation outside the JSON). The structure must be:
{
  "services": [
    {
      "title": "string",
      "slug": "kebab-case-string",
      "description": "2-3 sentences",
      "shortDescription": "1 sentence",
      "features": ["feature1", "feature2", "feature3", "feature4"],
      "faqs": [{"question": "...", "answer": "..."}],
      "heroSubtitle": "1 sentence",
      "longDescription": "2-3 paragraphs",
      "whatWeCover": [{"title": "...", "description": "..."}],
      "whyChooseUs": [{"bold": "...", "text": "..."}]
    }
  ],
  "homepage": {
    "metaTitle": "<60 chars",
    "metaDescription": "120-160 chars",
    "heroTitle": "short punchy title",
    "heroSubtitle": "supporting text",
    "heroBadges": ["badge1", "badge2", "badge3"],
    "whyChooseTitle": "string",
    "whyChooseSubtitle": "string",
    "whyChooseCards": [{"title": "...", "description": "..."}],
    "faqs": [{"question": "...", "answer": "..."}]
  },
  "about": {
    "metaTitle": "<60 chars",
    "metaDescription": "string",
    "heroTitle": "string",
    "heroSubtitle": "string",
    "heading": "string",
    "paragraphs": ["para1", "para2", "para3"],
    "badge": "short trust text",
    "stats": [{"value": "15+", "label": "Years Experience"}]
  },
  "contact": {
    "metaTitle": "<60 chars",
    "metaDescription": "string",
    "heroTitle": "string",
    "heroSubtitle": "string",
    "faqs": [{"question": "...", "answer": "..."}]
  },
  "reviews": {
    "metaTitle": "string",
    "metaDescription": "string",
    "sourceSummary": "1 sentence"
  },
  "servicesPage": {
    "metaTitle": "string",
    "metaDescription": "string",
    "heroTitle": "string",
    "heroSubtitle": "string"
  },
  "whatsappMessage": "short greeting",
  "legal": {
    "servicesList": ["service1", "service2"]
  }
}`;

  console.log('  Calling Claude CLI for content generation...');
  const result = await callClaudeCLI(prompt, { timeoutMs: 600_000 }); // 10 min timeout for content

  console.log(`  Services: ${result.services.length} generated`);
  for (const s of result.services) {
    console.log(`    - ${s.title} (/${s.slug}/)`);
  }
  console.log(`  Homepage hero: "${result.homepage.heroTitle}"`);
  console.log(`  About heading: "${result.about.heading}"`);

  return result;
}

// ---------------------------------------------------------------------------
// Phase 9: QA Analysis
// ---------------------------------------------------------------------------

export async function analyzeQAResults(qaOutput, buildLogContent) {
  const prompt = `You are a QA engineer reviewing the build results for a local service website (Astro + Tailwind).
Analyse the errors and warnings from the build process. Determine which issues are critical and suggest specific file-level fixes.
Only suggest fixes that can be done via text replacement in files — no manual intervention.

Review these build QA results and decide what to do:

## Post-Build QA Output
${qaOutput || 'No QA issues detected.'}

## Build Log (recent entries)
${buildLogContent || 'No build log entries.'}

## Instructions
For each issue found:
1. **FIX** — provide the exact file path, text to find, and text to replace
2. **SKIP** — explain why it's acceptable to ignore
3. **REBUILD** — this requires rebuilding after applying fixes

If everything looks good, verdict should be "pass".
If there are fixable issues, verdict should be "fix-and-rebuild".
If there are issues requiring human judgment, verdict should be "manual-review-needed".

RESPOND WITH ONLY A JSON OBJECT (no markdown, no explanation outside the JSON):
{
  "verdict": "pass|fix-and-rebuild|manual-review-needed",
  "issues": [
    {
      "description": "What the issue is",
      "action": "fix|skip|rebuild",
      "fixDescription": "What the fix does (if action=fix)",
      "filePath": "path/to/file (if action=fix)",
      "searchText": "text to find (if action=fix)",
      "replaceText": "text to replace with (if action=fix)"
    }
  ],
  "summary": "Brief summary of QA results"
}`;

  console.log('  Calling Claude CLI for QA analysis...');
  const result = await callClaudeCLI(prompt);

  console.log(`  Verdict: ${result.verdict}`);
  console.log(`  Issues: ${result.issues.length}`);
  console.log(`  Summary: ${result.summary}`);

  return result;
}
