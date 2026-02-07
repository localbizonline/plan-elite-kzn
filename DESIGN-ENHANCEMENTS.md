# Design Enhancements — Plan Elite KZN

Phase 7.8 — Applied 2026-02-07

## Context
- **Niche:** Building Construction & Property Development
- **Direction:** Luxury/Refined with Industrial undertones
- **Competitor Insight:** 12 competitors analyzed (6 local KZN, 2 Perth, 2 Cape Town, 2 Dallas)
- **Key Gaps Found:** No competitors show Google reviews prominently; most use flat dark overlays; portfolio-first approach underused in KZN

## Enhancements Applied

### 1. Hero Gradient Overlay (CSS)
- **Category:** CSS
- **Aggressiveness:** Low
- **What:** Replaced flat `bg-primary/75` with `bg-gradient-to-br from-primary/85 via-primary/70 to-primary/55`
- **Why:** All KZN competitors use flat dark overlays — gradient adds depth and modern feel (seen in international refs like Thomas DC)
- **Files:** `src/components/Hero.astro`

### 2. Hero CTA Personalization (Copy)
- **Category:** Hero
- **Aggressiveness:** Low
- **What:** Changed "Call Now" to "Call Now — Free Quote" and "Get Free Quote" to "View Our Services" (links to /services/)
- **Why:** Building niche benefits from showcasing service breadth (6 services). Portfolio/services CTA differentiates from generic "Contact Us" competitors
- **Files:** `src/components/Hero.astro`

### 3. ValueStrip Between Hero and TrustBadges (Component)
- **Category:** Component
- **Aggressiveness:** Medium
- **What:** Injected ValueStrip with 3 props: "Free Consultation / No Obligation", "NHBRC Registered / Full Warranty", "Turnkey Projects / Plans to Keys"
- **Why:** No KZN competitor has a value strip. Quick Build KZN has a gold accent strip but only for years in business — ours communicates specific value props
- **Files:** `src/pages/index.astro`, `src/site.config.ts`

### 4. CTA Banner — Stats Bar Variant (Config)
- **Category:** Component
- **Aggressiveness:** Medium
- **What:** Set CTA banner to `stats-bar` variant displaying: 10+ Years, 20+ Happy Clients, 4.8★ Google Rating
- **Why:** Established business (2016), 20 reviews, 4.8 rating — stats-bar is ideal for social proof. No KZN competitor uses a stats-focused CTA banner
- **Files:** `src/site.config.ts`

### 5. Mixed-Case Heading Hierarchy (CSS)
- **Category:** CSS
- **Aggressiveness:** Medium
- **What:** H1 stays uppercase for impact, H2/H3+ go sentence case for warmth and premium readability
- **Why:** All competitors use uppercase throughout — sentence case on H2+ creates a refined, editorial feel matching the Luxury/Refined direction. Pinnacle Construction (most upmarket competitor) uses a similar approach
- **Files:** `src/styles/global.css`

### 6. Accent Underline on Section Headings (CSS)
- **Category:** CSS
- **Aggressiveness:** Low
- **What:** 60px gold accent bar under all section H2 headings
- **Why:** Visual punctuation that ties section headings to the gold brand accent. Subtle but reinforces premium feel
- **Files:** `src/styles/global.css`

### 7. Warm Surface Shadows (CSS)
- **Category:** CSS
- **Aggressiveness:** Low
- **What:** Replaced cool grey shadows with warm-tinted shadows (rgba 120,100,80)
- **Why:** Complements the warm cream background (#F5F3EF) and gold accent. Cool grey shadows felt disconnected from the warm palette
- **Files:** `src/styles/global.css`

## Build Result
- **Build passed:** Yes
- **Pages:** 18
- **Build time:** 1.27s
- **Errors:** 0
- **Warnings:** 0
