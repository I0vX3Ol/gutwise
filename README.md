# GutWise

A static content site for the low-FODMAP / IBS niche, built with Astro and Tailwind CSS and designed to deploy to Cloudflare Pages at `gutwise.nexudel.com`.

Calm, evidence-based recipes and phase guides for people managing IBS — with tested portion limits on every recipe, structured data throughout, and WCAG 2.1 AA compliance enforced in CI.

---

## Before deploying publicly

Nothing in this repository is fabricated. There are no invented testimonials and no affiliate links — see [Monetisation](#monetisation) for why, and what would have to happen to add either.

Two things still need a human before launch:

- **Imagery.** Every image in `public/images/` is a generated abstract SVG placeholder. The `imageAlt` text in the content describes the *intended photograph*, so it will be correct once real photos replace the placeholders — but it does not describe the placeholders themselves. See [Replacing the imagery](#replacing-the-imagery).
- **Medical content.** The recipes and guides reflect widely published Monash-aligned guidance, but nothing here has been reviewed by a registered dietitian. Have a qualified professional review the content before publishing health information at scale.

There is still a guard rail for sample content: any content file marked `placeholder: true` in its frontmatter is printed by `npm run check:site` on **every build** until the flag is cleared. Nothing currently carries it.

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
| Monetisation | None | No affiliate links, no sponsorship, no ads — see below |
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

Deployment runs from GitHub Actions, not from Cloudflare's own Git
integration. The `deploy` job in `.github/workflows/ci.yml` uploads the exact
`dist/` artifact that already passed the contrast and site checks, so nothing
reaches production without clearing the same gates — a Cloudflare-side build
would bypass all of them. It also creates the Pages project on first run, so
there is nothing to click in the dashboard to get started.

Do **not** additionally connect the repository under **Workers & Pages →
Connect to Git**. That would build the site a second time, from a pipeline with
no verification in it, and the two would race.

### 1. Give the workflow credentials

Two repository secrets, and nothing else, stand between a green build and a
live site. Set them from the terminal so the token is never pasted into a
browser or left in a file:

```bash
gh secret set CLOUDFLARE_API_TOKEN --repo I0vX3Ol/gutwise
```

```bash
gh secret set CLOUDFLARE_ACCOUNT_ID --repo I0vX3Ol/gutwise
```

Each command prompts for the value and reads it without echoing.

The API token needs exactly two permissions, created at
[dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens)
as a **Custom token**:

| Scope | Permission | Access |
| --- | --- | --- |
| Account | Cloudflare Pages | Edit |
| Zone | DNS | Edit (scoped to `nexudel.com`) |

The account ID is in the Cloudflare dashboard sidebar under **Workers & Pages**,
and in the dashboard URL itself.

Until both are set the deploy job does not fail — it emits a `Deploy skipped`
warning on the run and stops. That keeps `main` honestly green ("verified, not
released") instead of permanently red for a missing credential.

Then trigger a release without needing a commit — secrets are read at run time,
so an existing run will not pick up a newly added one:

```bash
gh workflow run CI --repo I0vX3Ol/gutwise --ref main
```

### 2. Set environment variables

Build-time values are **repository variables** (`vars`), not secrets: every one
is prefixed `PUBLIC_` and inlined into the client bundle, so hiding them would
be theatre. Set with `gh variable set NAME --repo I0vX3Ol/gutwise`. All are
optional — unset, the site drops the GA4 snippet, the cookie banner, the
Turnstile widget and the newsletter form rather than rendering anything broken.

| Variable | Purpose |
| --- | --- |
| `SITE_URL` | Canonical origin. Defaults to `https://gutwise.nexudel.com` |
| `PUBLIC_GA4_ID` | GA4 measurement ID |
| `PUBLIC_CF_BEACON_TOKEN` | Cloudflare Web Analytics token |
| `PUBLIC_TURNSTILE_SITE_KEY` | Turnstile site key (public by design) |
| `PUBLIC_NEWSLETTER_ACTION` | Provider endpoint. Setting it switches the signup form on |

Runtime values for the Pages Functions are a different thing entirely. They are
read by the Workers runtime when a form is submitted, not at build time, so
GitHub never sees them — set these in the Cloudflare dashboard under the Pages
project's **Settings → Environment variables**, marked **Encrypted**:

| Variable | Encrypted | Purpose |
| --- | --- | --- |
| `TURNSTILE_SECRET_KEY` | **Yes** | Turnstile secret — server-side verification only |
| `CONTACT_FORWARD_ENDPOINT` | **Yes** | Where validated contact submissions are forwarded |
| `NEWSLETTER_ENDPOINT` | **Yes** | Optional override, to keep the real endpoint out of the client bundle |
| `NEWSLETTER_API_KEY` | **Yes** | Optional, if your provider's endpoint requires a key |

Never commit real values. `.env` is gitignored and `.env.example` is the
template, and it covers both sets — which is which is marked in the comments
there.

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

## Monetisation

**There is none.** No affiliate links, no sponsorship, no paid placements, no
display ads. The product recommendations link straight to the maker or say
"any supermarket", and several picks deliberately have no link at all — sending
someone to a specific product page for lactose-free milk or plain oats is worse
advice than "buy any".

This is stated on `/funding/`, summarised above the fold on every product page
by `FundingNote.astro`, and reflected in the privacy policy and about page. The
one thing the site asks for is an email address, in exchange for the Starter Kit.

If you add affiliate links later, three things are required, not optional:

1. **Disclose above the fold, before the first paid link.** The FTC standard is
   "clear and conspicuous"; a footer mention does not meet it. `FundingNote.astro`
   is where that text belongs — rewrite it to describe the real arrangement.
2. **Mark the links** `rel="nofollow sponsored"` in
   `src/pages/product-recommendations/[slug].astro`. They are currently
   `rel="nofollow"` only, because nothing is paid.
3. **Rewrite `/funding/`, the about page and the privacy policy** to name every
   programme, and update `FUNDING_NOTE` in `src/consts.ts`.

Until all three are done, leaving the current copy in place while running paid
links would be a false statement on a health site. The copy says "we earn
nothing" in several places — that has to stop being true in the code and the
text at the same moment.

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
├── recipes/    15 recipes    — portion limits, per-ingredient FODMAP flags
├── guides/      5 guides     — the three phases, the food list, eating out
└── products/    1 roundup    — product picks with rationale, no paid links
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

1. Drop the files into `public/images/recipes/` (or `guides/`, `products/`)
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
│   ├── consts.ts               Site config, nav, funding note, phases
│   └── content.config.ts       Collection schemas
└── astro.config.mjs
```

---

## SEO

Every page carries a unique `<title>` (15–60 chars) and meta description (70–165), an absolute canonical, a per-page OG image, and a single JSON-LD `@graph`. All of it is asserted by `npm run check:site`.

Structured data: `Organization` and `WebSite` sitewide; `Recipe` on recipes; `FAQPage` on `/faq/`, on each guide with FAQs, and on the home page; `BreadcrumbList` on every nested page; `Article` on guides and roundups; `ContactPage` on `/contact/`.

`sitemap-index.xml` is generated at build with tuned priorities, excluding `/thank-you/` and `/404`. `/thank-you/` is additionally `noindex` in both the page head and the `_headers` file — it exists as a conversion destination for GA4 goals, not for search.

No global `lastmod` is emitted. Stamping every URL with the build time would claim the entire site changed on every deploy, which is precisely how a `lastmod` signal gets discounted.

`robots.txt` deliberately does **not** block `/og/`. Facebook, LinkedIn and X all honour robots.txt when fetching `og:image`, so disallowing that path would silently break the social preview on every page; the images are kept out of image search with an `X-Robots-Tag: noindex` header instead. `check:site` fails the build if that `Disallow` ever comes back.

A combined RSS feed is served at `/rss.xml` covering recipes, guides and roundups, and is advertised via `<link rel="alternate">` on every page.

`check:site` also resolves **every internal link** against the build output, so deleting a route and leaving a link behind fails CI rather than shipping a 404.

---

## Licence

Code is MIT (see `LICENSE`). Site content in `src/content/` and `src/data/` is not covered by that licence.
