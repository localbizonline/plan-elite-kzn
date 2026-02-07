# Plan Elite KZN

> Building Construction & Property Development business in Durban, South Africa

## Project Info

| Field | Value |
|-------|-------|
| **Netlify URL** | https://plan-elite-kzn.netlify.app |
| **GitHub Repo** | https://github.com/localbizonline/plan-elite-kzn |
| **Owner** | Riaan Van Rooyen |
| **Phone** | 081 000 9096 |
| **Email** | riaan@elitecompanygroup.com |
| **Built** | 2026-02-07 |
| **Builder** | client-website-builder-template |

## Stack

Astro + Tailwind CSS v4 + Netlify. Built from `local-service-template`.

## Commands

```bash
npm run dev      # Local dev server
npm run build    # Production build
npx netlify-cli deploy --dir=dist --prod  # Deploy
```

## Key Files

- `src/site.config.ts` — All site content, services, about text, contact info
- `src/styles/global.css` — Theme (generated from design tokens)
- `src/images.ts` — Convention-based image registry (src/assets/images/)
- `design-tokens.json` — Design direction (fonts, colors, style)
- `client-config.json` — Raw Airtable data

## Design

| Element | Value |
|---------|-------|
| **Style** | Luxury/Refined with Industrial undertones |
| **Heading Font** | Montserrat |
| **Body Font** | Merriweather |
| **Primary Color** | #0E1235 |
| **Accent Color** | #C5943A |

## Pages

- `/` — Home
- `/about-us/` — About
- `/contact/` — Contact
- `/reviews/` — Reviews
- `/services/` — Services Hub
- `/services/building-construction/` — Building & Construction
- `/services/nutec-wendy-houses/` — Nutec & Wendy Houses
- `/services/paving-landscaping/` — Paving & Landscaping
- `/services/tiling-flooring/` — Tiling & Flooring
- `/services/awnings-lapas/` — Awnings & Lapas
- `/services/cladding-walling/` — Cladding & Walling
- `/building-construction-property-development-durban-north-umhlanga-ballito/` — Durban North, Umhlanga & Ballito
- `/building-construction-property-development-durban-pinetown-hillcrest-bluff/` — Durban, Pinetown, Hillcrest & Bluff
- `/building-construction-property-development-south-coast-kzn/` — South Coast KZN
- `/privacy-policy/` — Privacy Policy
- `/terms-and-conditions/` — Terms & Conditions
- `/thank-you/` — Thank You
- `/404` — Not Found

## Rules

- No pricing page
- Max 6 service pages, max 3 city pages
- Images use convention-based folder structure in `src/assets/images/` — don't hardcode paths
- Content lives in `site.config.ts` — don't scatter text across components
