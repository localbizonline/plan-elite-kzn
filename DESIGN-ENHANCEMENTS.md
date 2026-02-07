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

### 8. Split Hero with Trust Cluster (Structural HTML)
- **Category:** Hero — Structural
- **Aggressiveness:** High
- **What:** Complete hero rewrite from centered single-column to 5-column grid split layout. Left column: GoogleBadge + H1 + subtitle + dual CTAs + mobile YearsBadge. Right column (desktop): frosted glass trust cluster card showing NHBRC/SACAP/CIDB accreditation badges with shield icons, divider line, YearsBadge, and star rating display.
- **Why:** Competitors like Devco (Perth) and Thomas DC (Dallas) use split hero layouts to maximize trust signals above the fold. No KZN building competitor clusters accreditations in the hero. The frosted glass card (`bg-white/8 backdrop-blur-md`) creates depth against the background image while keeping text legible.
- **Files:** `src/components/Hero.astro`

### 9. Angle Section Divider Below Hero (Component)
- **Category:** Component
- **Aggressiveness:** Medium
- **What:** Added SectionDivider with `shape="angle"` between the hero and the next section. Used `!important` override since uniqueness-config had set `sectionDividerShape: "none"` globally.
- **Why:** Architectural angle shape ties into the building/construction niche. Creates visual break between full-bleed hero and content sections. Competitors use flat edges — the angle adds dynamism.
- **Files:** `src/components/Hero.astro`, `src/styles/global.css`

### 10. Scroll Reveal Animations (Layout + CSS)
- **Category:** Layout / Animation
- **Aggressiveness:** Medium
- **What:** Added IntersectionObserver script to BaseLayout.astro. Wrapped all homepage sections in `<div class="reveal">` containers. CSS transitions: opacity 0 to 1 with 28px upward translate, 0.65s ease-out timing, 8% threshold trigger.
- **Why:** Premium construction sites like Pinnacle and Thomas DC use scroll animations. Adds perceived quality and guides the eye through the page. Uses `observer.unobserve()` to fire only once per element.
- **Files:** `src/layouts/BaseLayout.astro`, `src/pages/index.astro`, `src/styles/global.css`

### 11. Service Card "Free Quote" Ribbons (Component + CSS)
- **Category:** Component
- **Aggressiveness:** Medium
- **What:** Added a `service-card__price-tag` ribbon div to each service card. Gold accent background, white text, CSS `clip-path: polygon()` for angled left edge. Changed card container from `overflow-hidden` to `overflow-visible` for ribbon visibility.
- **Why:** No competitor uses card ribbons. Reinforces the "free quote" message on every service card. The gold ribbon catches the eye and differentiates from grid-of-plain-cards layouts common in KZN competitors.
- **Files:** `src/components/Services.astro`, `src/styles/global.css`

### 12. Homepage Section Reorder (Layout)
- **Category:** Layout
- **Aggressiveness:** Low
- **What:** Moved Gallery section up to appear directly after Services (before ServiceAreas and Why Choose Us). New order: Hero > ValueStrip > TrustBadges > GoogleReviewWidget > Services > Gallery > ServiceAreas > Why Choose Us > FAQ > ContactForm.
- **Why:** Building/construction is a visual niche. Showing portfolio work immediately after the service list reinforces capability. Competitors like Devco and Pinnacle lead with portfolio — we follow services with visual proof.
- **Files:** `src/pages/index.astro`

### 13. Inline Uppercase Removal Across All Pages (Template Tell)
- **Category:** CSS / Template Tell
- **Aggressiveness:** High
- **What:** Removed `uppercase` class from H2 and H3 elements in 15 files: Gallery.astro, FAQ.astro, ContactForm.astro, ReviewsStrip.astro, ServiceAreas.astro, Services.astro, services/[slug].astro, about-us.astro, contact.astro, reviews.astro, [slug].astro, terms-and-conditions.astro, privacy-policy.astro. Also fixed a typo (`van` to `var`) in terms-and-conditions.astro Contact heading.
- **Why:** The CSS heading hierarchy (Enhancement #5) sets H1 to uppercase and H2+ to sentence case via CSS. But inline `uppercase` Tailwind classes in the HTML were overriding the CSS. Removing them allows the global CSS hierarchy to work correctly and eliminates a template tell (every template site would have uppercase H2s otherwise).
- **Files:** 15 component and page files across the project

## Build Result
- **Build passed:** Yes
- **Pages:** 18
- **Build time:** 1.29s
- **Errors:** 0
- **Warnings:** 0

## Summary
13 total enhancements applied across CSS, structural HTML, components, layout, and template tell removal. The site now has a split hero with trust cluster, scroll animations, service card ribbons, architectural section dividers, and a refined mixed-case heading hierarchy. These changes differentiate Plan Elite KZN from both the template baseline and all analyzed KZN competitors.
