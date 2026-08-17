# GutWise

A static content site for the low-FODMAP / IBS niche, built with Astro and Tailwind CSS and designed to deploy to Cloudflare Pages at `gutwise.nexudel.com`.

Calm, evidence-based recipes and phase guides for people managing IBS — with tested portion limits on every recipe, structured data throughout, and WCAG 2.1 AA compliance enforced in CI.

---

## ⚠ Read this before deploying publicly

Three things in this repository are **illustrative samples, not real content**, and must be replaced before the site is published:

| File | What's wrong with shipping it |
| --- | --- |
| `src/content/stories/maria-reintroduction-story.md` | Invented reader testimonial. Publishing it as a genuine account is dishonest and breaches the [FTC Endorsement Guides](https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides-what-people-are-asking). |
| `src/content/stories/james-hidden-fodmaps-story.md` | Same. |
| `src/content/products/low-fodmap-pantry-starter-kit.md` | Affiliate URLs are placeholder Amazon **search** links carrying an unregistered tag (`gutwise-20`). Product claims have not been independently verified. |

Each is marked `placeholder: true` in its frontmatter, and `npm run check:site` prints them on **every build** until you clear the flag. Replace the content, then delete the `placeholder: true` line.

Two further points before launch:

- **Imagery.** Every image in `public/images/` is a generated abstract SVG placeholder. The `imageAlt` text in the content describes the *intended photograph*, so it will be correct once real photos replace the placeholders — but it does not describe the placeholders themselves. See [Replacing the imagery](#replacing-the-imagery).
- **Medical content.** The recipes and guides reflect widely published Monash-aligned guidance, but nothing here has been reviewed by a registered dietitian. Have a qualified professional review the content before publishing health information at scale.

---

## Stack

| Concern | Choice | Why |
| --- | --- | --- |
| Framework | [Astro 7](https://astro.build) (`output: 'static'`) | Zero JS by default; the whole site ships ~4 KB of script |
| Styling | [Tailwind CSS 4](https://tailwindcss.com) via `@tailwindcss/vite` | Design tokens live in `@theme` in `src/styles/global.css` |
| Content | Astro content collections (Markdown + a JSON data collection) | Schema-validated at build time — bad frontmatter fails the build |
| Hosting | Cloudflare Pages | Static assets at the edge, plus two Pages Functions for the forms |
| Forms | Cloudflare Pages Functions + Turnstile | No database, no backend to maintain |
| Email | ConvertKit / Mailchimp, via `/api/subscribe` | Validated and forwarded; nothing stored on our side |
| Lead magnet | Generated PDF (`pdfkit`) | Built from source, so the file and the copy cannot drift |
| Social images | `satori` + `@resvg/resvg-js` at build time | A custom OG image per page, generated deterministically |
| Analytics | GA4 (consent-gated) + Cloudflare Web Analytics | Cookieless baseline; GA4 only after opt-in |

No user accounts, no database, no server-side state. That is a deliberate choice: it removes entire categories of vulnerability rather than mitigating them.

---

## Quick start

```bash
npm install
```

```bash
npm run dev
```

The dev server runs at `http://localhost:4321`. No environment variables are needed for local development — analytics, Turnstile and the newsletter form all degrade gracefully when unset.

### Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Static build to `dist/`, then generates `dist/_headers` |
| `npm run preview` | Serve the built output locally |
| `npm run check` | `astro check` — TypeScript and template diagnostics |
| `npm run check:functions` | Type-checks the Pages Functions against the Workers runtime |
| `npm run check:contrast` | Asserts all 31 colour pairs against WCAG 2.1 AA |
| `npm run check:site` | Audits the built `dist/` for SEO, a11y and structured data |
| `npm run verify` | Build + both checks. Run this before every deploy |
| `npm run images` | Regenerates the placeholder art, favicon and touch icons |
| `npm run kit` | Rebuilds the Starter Kit PDF (`DEBUG_LAYOUT=1` for a fill report) |
| `npm run audit:deps` | Fails on high/critical advisories in runtime deps |

---

## Deploying to Cloudflare Pages

### 1. Create the Pages project

In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect to Git**, and select this repository.

| Setting | Value |
| --- | --- |
| Framework preset | Astro |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node version | `22` (set `NODE_VERSION=22` if the default is older) |

The `functions/` directory at the repo root is picked up automatically — no extra configuration needed for the contact endpoint.

### 2. Set environment variables

**Settings → Environment variables.** Anything prefixed `PUBLIC_` is inlined into the client bundle and is world-readable; everything else must be marked **Encrypted**.

| Variable | Scope | Encrypted | Purpose |
| --- | --- | --- | --- |
| `SITE_URL` | Production | No | `https://gutwise.nexudel.com` — set per-environment so previews emit correct canonicals |
| `PUBLIC_GA4_ID` | Production | No | GA4 measurement ID. Omit to drop the GA4 snippet and the cookie banner entirely |
| `PUBLIC_CF_BEACON_TOKEN` | Production | No | Cloudflare Web Analytics token |
| `PUBLIC_TURNSTILE_SITE_KEY` | Both | No | Turnstile site key (public by design) |
| `TURNSTILE_SECRET_KEY` | Both | **Yes** | Turnstile secret — server-side verification only |
| `PUBLIC_NEWSLETTER_ACTION` | Both | No | Provider endpoint. Setting it is what switches the signup form on |
| `NEWSLETTER_ENDPOINT` | Both | **Yes** | Optional override, to keep the real endpoint out of the client bundle |
| `NEWSLETTER_API_KEY` | Both | **Yes** | Optional, if your provider's endpoint requires a key |
| `CONTACT_FORWARD_ENDPOINT` | Both | **Yes** | Where validated contact submissions are forwarded |

Never commit real values. `.env` is gitignored and `.env.example` is the template.

Both forms post to same-origin Pages Functions (`/api/subscribe`, `/api/contact`) rather than straight to a third party. That is what makes Turnstile meaningful — a token the email provider cannot verify gates nothing — and it is what keeps `/thank-you/` as the landing page your conversion goals fire on, instead of the provider's own confirmation screen.

### 3. DNS

Add a CNAME on `nexudel.com`:

```
Type: CNAME   Name: gutwise   Target: <project>.pages.dev   Proxy: Proxied (orange cloud)
```

The proxy must be **on** — that is what puts TLS, the security headers, bot protection and rate limiting at the edge. Then add `gutwise.nexudel.com` under **Custom domains** in the Pages project.

### 4. Cloudflare settings to enable

- **SSL/TLS → Overview:** Full (strict)
- **SSL/TLS → Edge Certificates:** Always Use HTTPS **on**, HSTS **on** (the site also sends its own `Strict-Transport-Security` header with `preload`)
- **Security → Turnstile:** create a widget, take the site key and secret key
- **Security → WAF → Rate limiting rules:** limit `POST /api/contact` to roughly 5 requests per minute per IP
- **Analytics → Web Analytics:** add the site, copy the beacon token

### 5. Post-deploy

- Submit `https://gutwise.nexudel.com/sitemap-index.xml` in Google Search Console
- Validate a recipe page in the [Rich Results Test](https://search.google.com/test/rich-results)
- Check the headers landed: `curl -sI https://gutwise.nexudel.com | grep -i content-security-policy`
- Submit both forms once against production and confirm each lands on `/thank-you/`
- Paste a recipe URL into the [Facebook sharing debugger](https://developers.facebook.com/tools/debug/) and confirm the OG image renders

## The lead magnet

Every CTA on the site promises a 14-page PDF, so it is generated from source
(`scripts/generate-starter-kit.mjs`) rather than being a binary someone has to
remember to update. It contains the safe-foods list, the two-week meal plan, a
printable symptom tracker, a shopping checklist and the label-reading guide.

The generator **hard-fails if the document is not exactly 14 pages**, and
`npm run check:site` re-checks the page count in the built output. This is not
theoretical: the first version silently produced 40 pages, because pdfkit treats
a footer drawn below the bottom margin as content overflow and starts a new page
for each one.

Run `DEBUG_LAYOUT=1 npm run kit` for a per-page fill report if you edit the
content — it shows how close each page came to the bottom.

It is delivered two ways: by email through the provider, and as a direct
download on `/thank-you/`, because making someone wait on an inbox for something
they just asked for is a needless drop-off point.

---

## Security

The threat surface is deliberately small: no accounts, no database, no sessions, no cookies except consent-gated analytics.

**Secrets.** Nothing sensitive is committed. `.gitignore` covers `.env*`, `.dev.vars` and key material; [gitleaks](https://github.com/gitleaks/gitleaks) scans the **full history** on every push and PR (`.github/workflows/ci.yml`). Only `PUBLIC_`-prefixed values ever reach the client.

**Content-Security-Policy.** `dist/_headers` is generated after the build by `scripts/generate-headers.mjs`. Astro inlines small hoisted scripts, so rather than weakening the policy with `script-src 'unsafe-inline'`, the script hashes every inline script in the build and pins those exact `sha256` values. Injected script does not execute. The policy also sets `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'` and an explicit `form-action` allowlist.

Alongside it: HSTS with `preload`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, a restrictive `Permissions-Policy`, and COOP/CORP.

**Analytics consent.** GA4 is not merely consent-*mode* gated, it is
consent-*loaded*: `gtag.js` is never fetched until the visitor presses Accept.
The common pattern — load the tag immediately, tell it not to store cookies —
still sends data to Google before any choice is made. Declining here means no
Google code runs at all. Cloudflare Web Analytics is cookieless and loads
without consent, which the privacy policy states plainly rather than burying.

**Form handling** (`functions/api/contact.ts`, `functions/api/subscribe.ts`,
shared helpers in `shared/form-utils.ts`) — in execution order:

1. Method and content-type pinned; everything else rejected
2. Body size capped *before* parsing
3. Fields **whitelisted**, not merely validated — anything outside `ALLOWED_FIELDS` is dropped, which blocks parameter tampering
4. Honeypot checked before any expensive work
5. Turnstile verified server-side, failing **closed** if the verification call errors
6. Values length-bounded, control characters stripped, output HTML-escaped
7. Only validated fields are forwarded; nothing passes through from the original request

Client-side validation exists purely for fast feedback and is never trusted.
Errors render as a styled HTML page rather than raw JSON — a form post is a
browser navigation, and showing someone machine output with no way back is a
dead end.

`shared/` deliberately sits outside `functions/`, because every file under
`functions/` becomes a public URL and a shared module parked there would be
reachable from the internet.

**Dependencies.** `npm audit` runs in CI and fails on high/critical advisories in runtime dependencies; Dependabot opens grouped weekly PRs.

**If you ever add a database or accounts** — none are needed for this site — the corresponding requirements apply: Row-Level Security on every table, parameterised queries, `bcrypt`/`argon2` password hashing, `HttpOnly; Secure; SameSite` session cookies, and server-side authorisation on every gated route. Client-side checks are never sufficient.

---

## Accessibility

WCAG 2.1 AA is enforced, not aspirational.

**Colour contrast is verified in CI.** `scripts/check-contrast.mjs` asserts all 31 rendered colour pairs and fails the build below threshold. This mattered: two colours from the original brand direction do not pass.

| Colour | On cream | Result |
| --- | --- | --- |
| `#5B7C99` (brief's trust blue) | 4.10:1 | ✗ fails AA for body text |
| `#3C5A73` (shipped) | 6.77:1 | ✓ |
| `#7FA88F` (light sage) | 2.49:1 | ✗ — decorative fills only |
| `#5C8A72` (mid sage) | 3.68:1 | ✗ — decorative fills only |
| `#4C7361` (shipped text sage) | 5.00:1 | ✓ |

The lighter sages are retained for decoration; anything bearing text uses the darkened tokens.

**Also implemented and checked:**

- Skip-to-content link as the first focusable element on every page
- Visible 3px focus ring on all interactive elements, set globally
- Semantic landmarks (`header`, `nav`, `main`, `footer`) on every page
- Exactly one `<h1>` per page, with **no skipped heading levels** — card and callout components take a `level` prop so grids never jump `h1 → h3`
- `alt` on every image; `aria-label` on every icon-only control
- Labelled form fields, errors tied via `aria-describedby` and announced with `role="alert"`, never signalled by colour alone
- **FODMAP indicators pair colour with an icon *and* a text label** — WCAG 1.4.1, and doubly important for an audience anxious about food safety
- `prefers-reduced-motion` respected, including the smooth-scroll behaviour
- Native `<details>` for FAQs, so keyboard operation and find-in-page work without JS
- Alarm red avoided entirely; caution states use amber and clay

`npm run check:site` re-checks the built HTML for most of these. It is a strong safety net, **not a substitute for a screen-reader pass** — test with VoiceOver or NVDA before launch.

---

## Content

```
src/content/
├── recipes/     6 recipes    — portion limits, per-ingredient FODMAP flags
├── guides/      3 guides     — one per protocol phase, with per-guide FAQs
├── products/    1 roundup    — affiliate picks with rationale
└── stories/     2 stories    — reader outcomes
src/data/faqs.json            12 site-wide FAQ entries
```

Schemas live in `src/content.config.ts` and are strict by design — a meta description outside 70–165 characters, or an `imageAlt` under 10 characters, fails the build rather than shipping.

### Adding a recipe

Create `src/content/recipes/my-recipe.md`. The filename becomes the URL slug. Required frontmatter is defined by the `recipes` collection schema; copy an existing file as a starting point. The fields that matter most:

- `servingSizeNote` — the portion ceiling that keeps the dish low FODMAP. This is the single most important field on the page and renders above the ingredients.
- `ingredients[].fodmap` — `safe`, `moderate` or `high`, rendered as icon + text.
- `relatedGuides` — guide IDs, which build the recipe ↔ guide internal link mesh.

Add `seoTitle` when the headline is longer than about 50 characters, since the `| GutWise` suffix must keep the `<title>` under 60.

### Replacing the imagery

`public/images/` holds generated SVG placeholders. To swap in real photography:

1. Drop the files into `public/images/recipes/` (or `guides/`, `products/`, `stories/`)
2. Point the `image` frontmatter field at the new path
3. Confirm `imageAlt` describes the actual photo
4. Delete `scripts/generate-placeholders.mjs` and the `images` npm script once nothing depends on them

Use 3:2 or 8:5 landscape at 1280px wide or larger. Real, naturally lit food photography — the brand direction explicitly avoids a stock-photo look.

Social images are separate and need no work: `src/pages/og/[...slug].png.ts` generates a distinct 1200×630 PNG per page at build time. Adding content automatically adds its OG image, and `check:site` fails if a page ever references one that was not generated.

---

## Project structure

```
├── functions/api/
│   ├── contact.ts              Contact form: validation + Turnstile + forward
│   └── subscribe.ts            Newsletter: validation + Turnstile + forward
├── shared/form-utils.ts        Shared by both functions; outside functions/ so
│                               it is never routed as a public URL
├── public/                     Static assets, robots.txt, generated art, the PDF
├── scripts/
│   ├── check-contrast.mjs      WCAG contrast gate
│   ├── verify-site.mjs         Post-build SEO/a11y/schema audit
│   ├── generate-headers.mjs    Builds dist/_headers with hashed CSP
│   ├── generate-starter-kit.mjs  Builds the 14-page lead magnet PDF
│   └── generate-placeholders.mjs
├── src/
│   ├── components/             Header, Footer, cards, FODMAP tags, CTAs, consent
│   ├── content/                Markdown content collections
│   ├── layouts/BaseLayout.astro
│   ├── lib/
│   │   ├── schema.ts           schema.org builders (one @graph per page)
│   │   ├── og.ts               OG image registry and path helper
│   │   └── utils.ts
│   ├── pages/
│   ├── styles/global.css       Design tokens (@theme) and base layer
│   ├── consts.ts               Site config, nav, disclosures, phases
│   └── content.config.ts       Collection schemas
└── astro.config.mjs
```

---

## SEO

Every page carries a unique `<title>` (15–60 chars) and meta description (70–165), an absolute canonical, a per-page OG image, and a single JSON-LD `@graph`. All of it is asserted by `npm run check:site`.

Structured data: `Organization` and `WebSite` sitewide; `Recipe` on recipes; `FAQPage` on `/faq/`, on each guide with FAQs, and on the home page; `BreadcrumbList` on every nested page; `Article` on guides, roundups and stories; `ContactPage` on `/contact/`.

`sitemap-index.xml` is generated at build with tuned priorities, excluding `/thank-you/` and `/404`. `/thank-you/` is additionally `noindex` in both the page head and the `_headers` file — it exists as a conversion destination for GA4 goals, not for search.

No global `lastmod` is emitted. Stamping every URL with the build time would claim the entire site changed on every deploy, which is precisely how a `lastmod` signal gets discounted.

`robots.txt` deliberately does **not** block `/og/`. Facebook, LinkedIn and X all honour robots.txt when fetching `og:image`, so disallowing that path would silently break the social preview on every page; the images are kept out of image search with an `X-Robots-Tag: noindex` header instead. `check:site` fails the build if that `Disallow` ever comes back.

A combined RSS feed is served at `/rss.xml` covering recipes, guides, roundups and stories, and is advertised via `<link rel="alternate">` on every page.

---

## Licence

Code is MIT (see `LICENSE`). Site content in `src/content/` and `src/data/` is not covered by that licence.
