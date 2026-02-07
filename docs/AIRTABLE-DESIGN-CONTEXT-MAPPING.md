# Airtable Fields → Design Reviewer Context Mapping

This document maps existing Airtable fields to design reviewer use cases for creative, strategic suggestions.

## Available Fields (Existing in Airtable)

### 1. Business Identity & History
| Airtable Field | Type | Design Use |
|----------------|------|------------|
| `Year business started` | Number | Calculate years in business → "15+ Years" badges, trust signals, timeline sections |
| `About` | Rich Text | Owner story → About page authenticity, hero subheadings, personal connection |
| `Business Owner Name 2024` | Text | Personalize About page, "Meet [Name]" sections, testimonial attribution |
| `Business Owner Last Name` | Text | Full name for formal contexts |

### 2. Visual Assets
| Airtable Field | Type | Design Use |
|----------------|------|------------|
| `Logo` | Attachments | Primary brand color extraction, design theme alignment |
| `Headshot/team photo` | Attachments | About page hero, trust section, owner story visual |
| `Photos` | Attachments | Gallery, service evidence, authenticity signals |

### 3. Differentiation & Features ⭐
| Airtable Field | Type | Design Use | Creative Opportunities |
|----------------|------|------------|------------------------|
| `Features that best describe business` | Multiple Select | Hero badges, trust sections, USP highlights | **HIGH VALUE FOR DESIGN REVIEWER** |

**Available options:**
- ✅ **Free Quotes** → Add "Get Free Quote" badge to hero, CTA emphasis
- ✅ **Qualified and Licensed** → Generate certification badges, trust section prominence
- ✅ **Emergency After Hour Service** → Urgent design cues (red accents, pulsing badges, 24/7 emphasis)
- ✅ **Low Cost Affordable** → Budget-friendly aesthetics (avoid premium gold/serif fonts), price transparency
- ✅ **Owner Managed** → Personal brand emphasis (larger headshot, owner story hero)
- ✅ **Fast Response** → Urgency indicators, response time badges, speed-focused CTAs
- ✅ **Warranty and Guarantees** → Trust badges, guarantee seals, reassurance sections
- ✅ **Over 5 Years Experience** → Calculate exact years, timeline component, expertise signals
- ✅ **Top Quality** → Premium design cues (if selected), quality-focused imagery

### 4. Services & Location
| Airtable Field | Type | Design Use |
|----------------|------|------------|
| `Service The Business Offers 2024` | Linked Records | Service hierarchy, primary vs secondary services, menu structure |
| `Service Locations 2024` | Linked Records | Area coverage scope, multi-city vs local focus |
| `Website service areas` | Rich Text | Geographic scope → "Serving Greater Cape Town" messaging |

### 5. Marketing Context
| Airtable Field | Type | Design Use |
|----------------|------|------------|
| `Where businesses get leads from` | Multiple Select | If "Website" selected → emphasize online presence. If "Referrals" → emphasize trust/reviews |
| `Do you have a website?` | Single Select | Yes → competitor for comparison. No → opportunity to lead category |
| `Are you happy with your website?` | Single Select | No → identify pain points to avoid |

### 6. Social & Online Presence
| Airtable Field | Type | Design Use |
|----------------|------|------------|
| `Facebook page` | URL | Social proof link, embed feed if active |
| `Enriched Facebook` | URL | Fallback social link |
| `Enriched Instagram` | URL | Visual brand analysis, image style cues |
| `Google Business Profile` | URL | Review widget embed, map integration |
| `Web 2024` | URL | Scrape for competitor analysis, existing brand analysis |

### 7. Reviews & Social Proof ⭐
| Airtable Field | Type | Design Use | Creative Opportunities |
|----------------|------|------------|------------------------|
| `GMB Review Score` | Number | Display 4.8★ rating, add "Top Rated" badge if ≥4.5 | **HIGH VALUE** |
| `Link to reviews` | URL | Review page integration, widget embed | |
| `Company Reviews Source` | Single Select | Prioritize review display source | |

### 8. Social & Online Presence (CRITICAL) ⭐
| Airtable Field | Type | Design Use | Creative Opportunities |
|----------------|------|------------|------------------------|
| `Facebook page` | URL | **MUST add to footer if exists** | **CRITICAL** |
| `Google Business Profile` | URL | **MUST add to footer/contact if exists** | **CRITICAL** |
| `Enriched Instagram` | URL | Optional social link | **MEDIUM VALUE** |

---

## Design Reviewer Enhancement Strategy

### Phase 1: Read Extended Context (NEW)

Add to `teammate-design-reviewer.md` Step 1:

```markdown
### Step 1: Read Business Context (ENHANCED)

Read these files to understand the business:
- `{projectPath}/client-config.json` — ALL Airtable data including:
  - `yearBusinessStarted` → calculate years in business
  - `featuresDescribeBusiness` → array of selected features
  - `gmbReviewScore`, `gmbReviewCount` → social proof data
  - `about` → business story and personality
  - `whereBusinessesGetLeadsFrom` → current marketing channels
  - Logo/headshot URLs → visual assets available

- `{projectPath}/design-tokens.json` — current design direction
- `{projectPath}/BUSINESS-CONTEXT.md` — synthesized brief
- `{projectPath}/src/styles/global.css` — applied CSS
```

### Phase 2: Feature-Based Creative Suggestions

Map each selected feature to design opportunities:

#### If "Emergency After Hour Service" is selected:
```json
{
  "category": "urgency-design",
  "insight": "Business offers emergency/after-hours service but design doesn't convey urgency",
  "suggestion": "Add 24/7 pulsing badge to hero + red accent for emergency CTA + prominent phone number",
  "implementation": {
    "type": "multi-part",
    "changes": [
      {
        "type": "css-addition",
        "code": "@keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.85; transform: scale(1.05); } }\n.emergency-badge { animation: pulse 2s ease-in-out infinite; background: var(--color-red-600); color: white; }"
      },
      {
        "type": "config-update",
        "file": "site.config.ts",
        "field": "hero.badges",
        "value": ["24/7 EMERGENCY SERVICE", "FAST RESPONSE"]
      }
    ]
  },
  "reasoning": "Based on 'Emergency After Hour Service' feature from Airtable",
  "impact": "high",
  "effort": "low"
}
```

#### If "Owner Managed" is selected:
```json
{
  "category": "personal-brand",
  "insight": "Owner-managed business but owner isn't visually prominent",
  "suggestion": "Increase headshot size on About page, add personal story section to homepage, use owner name in CTAs ('Call [Owner Name]')",
  "implementation": {
    "type": "component-enhancement",
    "changes": [
      {
        "type": "css-override",
        "target": ".about-hero .headshot",
        "property": "max-width",
        "from": "300px",
        "to": "400px"
      },
      {
        "type": "component-addition",
        "component": "OwnerStorySection",
        "placement": "homepage-after-hero"
      }
    ]
  },
  "reasoning": "Based on 'Owner Managed' feature — personalization builds trust",
  "impact": "medium",
  "effort": "medium"
}
```

#### If "Low Cost Affordable" is selected:
```json
{
  "category": "price-positioning",
  "insight": "Business emphasizes affordability but design uses premium aesthetics (serif fonts, gold accents)",
  "suggestion": "Switch to more approachable design: sans-serif throughout, friendly colors (blues/greens), emphasize transparency and value",
  "implementation": {
    "type": "design-token-adjustment",
    "changes": {
      "headingFont": "Switch from serif to sans-serif (e.g., Inter, Work Sans)",
      "accentColor": "Avoid gold/premium colors, use trustworthy blue",
      "tone": "Friendly and transparent rather than elite"
    }
  },
  "reasoning": "Based on 'Low Cost Affordable' feature — design should match positioning",
  "impact": "high",
  "effort": "medium"
}
```

#### If "Warranty and Guarantees" is selected:
```json
{
  "category": "trust-signals",
  "insight": "Business offers warranties/guarantees but not visually emphasized",
  "suggestion": "Add guarantee badge to footer + service pages, create 'Our Guarantee' section on About page with shield icon",
  "implementation": {
    "type": "svg-badge-generation",
    "prompt": "Satisfaction guarantee badge, shield shape, professional style, blue and white",
    "placement": ["footer", "service-pages", "about-page"],
    "svgComponent": "GuaranteeBadge"
  },
  "reasoning": "Based on 'Warranty and Guarantees' feature — visual reinforcement of promise",
  "impact": "medium",
  "effort": "low"
}
```

### Phase 3: Review Score Visual Hierarchy

If `gmbReviewScore >= 4.5`:
```json
{
  "category": "social-proof-prominence",
  "insight": "Business has exceptional 4.8★ rating (above 4.5) but reviews aren't hero-level prominent",
  "suggestion": "Add animated star rating to hero section, increase review widget size, add 'Top Rated' badge",
  "implementation": {
    "type": "multi-part",
    "changes": [
      {
        "type": "component-addition",
        "component": "HeroRatingDisplay",
        "props": { "score": 4.8, "count": 156, "animated": true }
      },
      {
        "type": "css-enhancement",
        "target": ".hero-rating .stars",
        "code": ".star { fill: gold; animation: sparkle 2s ease-in-out infinite; }"
      }
    ]
  },
  "reasoning": "Based on GMB review score of 4.8/5 — exceptional ratings should be hero-level prominent",
  "impact": "high",
  "effort": "low"
}
```

### Phase 4: Years in Business Trust Signal

Calculate from `yearBusinessStarted`:
```javascript
const currentYear = new Date().getFullYear();
const yearsInBusiness = currentYear - yearBusinessStarted; // e.g., 2026 - 2010 = 16 years

if (yearsInBusiness >= 10) {
  // HIGH trust signal
  suggestion: "Add '16+ Years Trusted in [City]' badge to hero, create timeline section on About page"
}
```

### Phase 5: Lead Source Competitive Context

If `whereBusinessesGetLeadsFrom` includes "Website":
```json
{
  "insight": "Business already gets leads from their website — this is a replacement/upgrade scenario",
  "suggestion": "Focus on conversion rate optimization: larger CTAs, faster load times, mobile-first design, clear value propositions",
  "reasoning": "Existing website generates leads — new site must perform better or risk losing traffic"
}
```

If `whereBusinessesGetLeadsFrom` includes "Referrals" (but not "Website"):
```json
{
  "insight": "Business relies on referrals — first real web presence",
  "suggestion": "Emphasize trust signals: reviews prominent, years in business, owner story, testimonials above fold",
  "reasoning": "Referral-based businesses need to transfer offline trust to online credibility"
}
```

---

## Implementation: Enhanced Design Reviewer Prompt

Update `~/.claude/skills/client-website-builder-template/prompts/teammate-design-reviewer.md`:

### Add New Section After Step 1:

```markdown
### Step 1.5: Analyze Feature-Based Context (NEW)

Read `{projectPath}/client-config.json` and extract:

1. **Selected Features** (`featuresDescribeBusiness` array):
   - Map each feature to design requirements
   - Identify conflicts (e.g., "Low Cost Affordable" + premium design)
   - Generate feature-specific suggestions

2. **Years in Business** (calculate from `yearBusinessStarted`):
   - If 10+ years → HIGH trust signal, add timeline/badge
   - If 5-10 years → MEDIUM trust signal, mention experience
   - If <5 years → LOW trust signal, emphasize fresh/modern approach

3. **Review Data** (`gmbReviewScore`, `gmbReviewCount`):
   - If score >= 4.5 AND count >= 50 → HERO-LEVEL prominence
   - If score >= 4.0 → Standard review section
   - If missing → Generate "Request a Quote" emphasis instead

4. **Lead Sources** (`whereBusinessesGetLeadsFrom`):
   - Contains "Website" → Competitive replacement, must exceed current site
   - Contains "Referrals" → First web presence, transfer offline trust
   - Contains "Google Ads" → Conversion-focused, clear CTAs critical

### Step 1.6: Feature-Conflict Detection (NEW)

Check for design-feature mismatches:

**Example conflicts:**
- ❌ "Low Cost Affordable" selected BUT design uses gold accents + serif fonts (premium signals)
  - **Fix:** Suggest approachable sans-serif, blues/greens, transparency emphasis

- ❌ "Emergency After Hour Service" selected BUT hero has calm pastels + no urgency cues
  - **Fix:** Suggest red accent, pulsing 24/7 badge, prominent phone number

- ❌ "Owner Managed" selected BUT owner headshot is tiny/missing
  - **Fix:** Suggest larger headshot, personal story section, owner name in CTAs

- ❌ GMB score 4.8/5 BUT reviews not visible above fold
  - **Fix:** Suggest hero rating display, animated stars, "Top Rated" badge
```

### Update design-review.json Schema:

```json
{
  "featureBasedSuggestions": [
    {
      "feature": "Emergency After Hour Service",
      "currentState": "Hero design is calm with no urgency indicators",
      "desiredState": "Urgent, responsive, 24/7 visual emphasis",
      "suggestions": [
        {
          "type": "css-enhancement",
          "description": "Add pulsing animation to 24/7 badge",
          "impact": "high",
          "effort": "low"
        }
      ]
    }
  ],

  "dataBasedOpportunities": [
    {
      "dataSource": "gmbReviewScore: 4.8, gmbReviewCount: 156",
      "insight": "Exceptional rating (4.8/5) with strong volume (156 reviews) — this is a competitive advantage",
      "suggestion": "Move review display from footer to hero section with animated stars",
      "impact": "high",
      "effort": "low"
    },
    {
      "dataSource": "yearBusinessStarted: 2008",
      "insight": "18 years in business — significant trust signal underutilized",
      "suggestion": "Add '18+ Years Trusted in Cape Town' badge to hero, create timeline section on About page",
      "impact": "medium",
      "effort": "medium"
    }
  ]
}
```

---

## Next Steps

1. **Update `airtable-client-fetch` skill** to ensure all these fields are pulled and saved to `client-config.json`
2. **Update `teammate-design-reviewer.md`** prompt with feature-analysis logic
3. **Create feature-mapping reference** for design reviewer to use
4. **Test with Pro Gas build** to validate suggestions align with actual features

