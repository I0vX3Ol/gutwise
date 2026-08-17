#!/usr/bin/env node
/**
 * Pre-launch verification for the built site.
 *
 * Runs against dist/ after `astro build`, so it checks what actually ships
 * rather than what the source intends. Every rule here maps to a launch
 * requirement — WCAG 2.1 AA, the SEO checklist, or the structured-data plan.
 *
 * Run: npm run check:site   (or `npm run verify` for build + contrast + this)
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'node-html-parser';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

if (!existsSync(dist)) {
	console.error('✗ dist/ not found. Run `npm run build` first.');
	process.exit(1);
}

const errors = [];
const warnings = [];

const fail = (page, message) => errors.push({ page, message });
const warn = (page, message) => warnings.push({ page, message });

/** Recursively collect every built HTML file. */
function htmlFiles(dir) {
	const out = [];
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) out.push(...htmlFiles(full));
		else if (entry.endsWith('.html')) out.push(full);
	}
	return out;
}

const files = htmlFiles(dist);
const titles = new Map();
const descriptions = new Map();

/** Every internal href found, so they can be resolved once at the end. */
const internalLinks = [];

// Pages intentionally excluded from the index; these skip canonical/index rules.
const NOINDEX_PAGES = ['/thank-you/', '/404.html'];

for (const file of files) {
	const rel = '/' + relative(dist, file).replace(/index\.html$/, '');
	const html = readFileSync(file, 'utf8');
	const doc = parse(html);
	const isNoindex = NOINDEX_PAGES.some((p) => rel.startsWith(p) || rel === p);

	// ---------------------------------------------------------------- HTML base
	const htmlEl = doc.querySelector('html');
	if (!htmlEl?.getAttribute('lang')) {
		fail(rel, 'missing <html lang> — screen readers cannot pick a voice');
	}

	// -------------------------------------------------------------------- Title
	const title = doc.querySelector('title')?.text?.trim();
	if (!title) {
		fail(rel, 'missing <title>');
	} else {
		if (title.length < 15 || title.length > 60) {
			fail(rel, `<title> is ${title.length} chars, outside the 15–60 target: "${title}"`);
		}
		if (titles.has(title)) {
			fail(rel, `duplicate <title> — also used by ${titles.get(title)}`);
		} else {
			titles.set(title, rel);
		}
	}

	// -------------------------------------------------------------- Description
	const desc = doc
		.querySelector('meta[name="description"]')
		?.getAttribute('content')
		?.trim();

	if (!desc) {
		fail(rel, 'missing <meta name="description">');
	} else {
		if (desc.length < 70 || desc.length > 165) {
			fail(rel, `meta description is ${desc.length} chars, outside 70–165`);
		} else if (desc.length < 120) {
			warn(rel, `meta description is ${desc.length} chars — under the 150–160 sweet spot`);
		}
		if (descriptions.has(desc)) {
			fail(rel, `duplicate meta description — also used by ${descriptions.get(desc)}`);
		} else {
			descriptions.set(desc, rel);
		}
	}

	// ---------------------------------------------------------------- Canonical
	const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href');
	if (!canonical) fail(rel, 'missing canonical link');
	else if (!canonical.startsWith('http')) fail(rel, 'canonical is not absolute');

	// ------------------------------------------------------------------- Robots
	const robots = doc.querySelector('meta[name="robots"]')?.getAttribute('content') ?? '';
	if (isNoindex && !robots.includes('noindex')) {
		fail(rel, 'conversion/error page is missing noindex');
	}
	if (!isNoindex && robots.includes('noindex')) {
		fail(rel, 'content page is unexpectedly noindex');
	}

	// --------------------------------------------------------------- Open Graph
	for (const prop of ['og:title', 'og:description', 'og:image', 'og:url', 'og:type']) {
		if (!doc.querySelector(`meta[property="${prop}"]`)) {
			fail(rel, `missing ${prop}`);
		}
	}
	for (const name of ['twitter:card', 'twitter:title', 'twitter:image']) {
		if (!doc.querySelector(`meta[name="${name}"]`)) {
			fail(rel, `missing ${name}`);
		}
	}

	// The OG image must be per-page AND must actually exist on disk.
	const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute('content');
	if (ogImage) {
		const path = ogImage.replace(/^https?:\/\/[^/]+/, '');
		if (!existsSync(join(dist, path))) {
			fail(rel, `og:image points at a file that was not generated: ${path}`);
		}
	}
	if (!doc.querySelector('meta[property="og:image:alt"]')) {
		warn(rel, 'missing og:image:alt');
	}

	// ---------------------------------------------------------------- Landmarks
	if (!doc.querySelector('main#main')) fail(rel, 'missing <main id="main"> landmark');
	if (!doc.querySelector('header')) fail(rel, 'missing <header> landmark');
	if (!doc.querySelector('footer')) fail(rel, 'missing <footer> landmark');
	if (!doc.querySelector('nav')) fail(rel, 'missing <nav> landmark');

	// --------------------------------------------------------------- Skip link
	const firstLink = doc.querySelector('body a');
	if (!firstLink || firstLink.getAttribute('href') !== '#main') {
		fail(rel, 'skip-to-content link is not the first focusable element in <body>');
	}

	// ----------------------------------------------------------------- Headings
	const h1s = doc.querySelectorAll('h1');
	if (h1s.length === 0) fail(rel, 'no <h1>');
	if (h1s.length > 1) fail(rel, `${h1s.length} <h1> elements — expected exactly 1`);

	// Heading levels must not skip (h2 -> h4), which breaks screen-reader outlines.
	const levels = doc
		.querySelectorAll('h1, h2, h3, h4, h5, h6')
		.map((h) => Number(h.tagName.slice(1)));
	for (let i = 1; i < levels.length; i++) {
		if (levels[i] - levels[i - 1] > 1) {
			fail(rel, `heading level skips from h${levels[i - 1]} to h${levels[i]}`);
			break;
		}
	}

	// -------------------------------------------------------------------- Images
	for (const img of doc.querySelectorAll('img')) {
		if (img.getAttribute('alt') === undefined) {
			fail(rel, `<img src="${img.getAttribute('src')}"> has no alt attribute`);
		}
		if (!img.getAttribute('width') || !img.getAttribute('height')) {
			warn(rel, `<img src="${img.getAttribute('src')}"> has no intrinsic size (CLS risk)`);
		}
	}

	// ------------------------------------------------------- Icon-only controls
	for (const btn of doc.querySelectorAll('button')) {
		const hasText = btn.text.trim().length > 0;
		const hasLabel =
			btn.getAttribute('aria-label') || btn.getAttribute('aria-labelledby');
		if (!hasText && !hasLabel) {
			fail(rel, 'icon-only <button> has no accessible name');
		}
	}

	// --------------------------------------------------------------- Form labels
	for (const field of doc.querySelectorAll('input, select, textarea')) {
		const type = field.getAttribute('type');
		if (type === 'hidden' || type === 'submit') continue;

		const id = field.getAttribute('id');

		// A wrapping <label> is implicit labelling and is perfectly valid, so
		// walk up the tree as well as looking for an explicit label[for].
		let ancestorLabel = false;
		for (let node = field.parentNode; node; node = node.parentNode) {
			if (node.rawTagName?.toLowerCase() === 'label') {
				ancestorLabel = true;
				break;
			}
		}

		const labelled =
			ancestorLabel ||
			(id && doc.querySelector(`label[for="${id}"]`)) ||
			field.getAttribute('aria-label') ||
			field.getAttribute('aria-labelledby');

		if (!labelled) {
			fail(rel, `form field ${id ? `#${id}` : `[name=${field.getAttribute('name')}]`} has no label`);
		}
	}

	// --------------------------------------------------------- Internal links
	// Collected here, resolved after the loop. Deleting a route and leaving a
	// link behind is the single easiest way to ship a 404 to a real reader.
	for (const a of doc.querySelectorAll('a[href]')) {
		const href = a.getAttribute('href');
		if (!href) continue;
		if (/^(https?:|mailto:|tel:|#|data:)/.test(href)) continue;
		internalLinks.push({ from: rel, href });
	}

	// ------------------------------------------------------------- Duplicate IDs
	const seen = new Set();
	for (const el of doc.querySelectorAll('[id]')) {
		const id = el.getAttribute('id');
		if (seen.has(id)) fail(rel, `duplicate id="${id}"`);
		seen.add(id);
	}

	// -------------------------------------------------------------- Structured data
	const ld = doc.querySelector('script[type="application/ld+json"]');
	if (!ld) {
		fail(rel, 'no JSON-LD block');
	} else {
		let data;
		try {
			data = JSON.parse(ld.text);
		} catch {
			fail(rel, 'JSON-LD is not valid JSON');
		}

		if (data) {
			const types = (data['@graph'] ?? []).map((n) => n['@type']);

			if (!types.includes('Organization')) fail(rel, 'JSON-LD missing Organization');
			if (!types.includes('WebSite')) fail(rel, 'JSON-LD missing WebSite');

			const needsBreadcrumb =
				/^\/(recipes|guides|product-recommendations|faq|about|contact|privacy-policy|funding)\//.test(
					rel,
				);
			if (needsBreadcrumb && !types.includes('BreadcrumbList')) {
				fail(rel, 'missing BreadcrumbList schema');
			}

			if (/^\/recipes\/[^/]+\/$/.test(rel) && !types.includes('Recipe')) {
				fail(rel, 'recipe page missing Recipe schema');
			}
			if (rel === '/faq/' && !types.includes('FAQPage')) {
				fail(rel, 'FAQ page missing FAQPage schema');
			}
		}
	}

	// ------------------------------------------------------------ Breadcrumb UI
	if (/^\/(recipes|guides|product-recommendations)\/[^/]+\/$/.test(rel)) {
		if (!doc.querySelector('nav[aria-label="Breadcrumb"]')) {
			fail(rel, 'detail page has no visible breadcrumb navigation');
		}
	}
}

// ------------------------------------------------------------------ Site files
for (const required of [
	'robots.txt',
	'sitemap-index.xml',
	'favicon.svg',
	'favicon-48.png',
	'apple-touch-icon.png',
	'site.webmanifest',
	'rss.xml',
	'_headers',
]) {
	if (!existsSync(join(dist, required))) {
		fail('/', `missing ${required} in build output`);
	}
}

// robots.txt must point at the sitemap, and must NOT block the OG images —
// Facebook, LinkedIn and X all honour robots.txt when fetching og:image, so a
// Disallow there silently kills the social preview on every page.
if (existsSync(join(dist, 'robots.txt'))) {
	const robotsTxt = readFileSync(join(dist, 'robots.txt'), 'utf8');
	if (!/^Sitemap:\s*https?:\/\//m.test(robotsTxt)) {
		fail('/robots.txt', 'no absolute Sitemap: directive');
	}
	if (/^\s*Disallow:\s*\/og\//m.test(robotsTxt)) {
		fail('/robots.txt', 'Disallow: /og/ would block social scrapers from og:image');
	}
}

// The lead magnet must exist and be the length every CTA advertises.
const kitPath = join(dist, 'downloads', 'gutwise-low-fodmap-starter-kit.pdf');
if (!existsSync(kitPath)) {
	fail('/', 'lead magnet PDF missing — every CTA on the site promises it');
} else {
	const pdf = readFileSync(kitPath, 'latin1');
	const counts = [
		...pdf.matchAll(/\/Type\s*\/Pages[\s\S]{0,300}?\/Count\s+(\d+)/g),
	].map((m) => Number(m[1]));
	const pages = counts.length ? Math.max(...counts) : 0;
	if (pages !== 14) {
		fail('/', `lead magnet is ${pages} pages; the site advertises 14`);
	}
}

// The feed must be well-formed enough to parse and carry entries.
if (existsSync(join(dist, 'rss.xml'))) {
	const feed = readFileSync(join(dist, 'rss.xml'), 'utf8');
	const itemCount = (feed.match(/<item>/g) ?? []).length;
	if (itemCount < 10) {
		fail('/rss.xml', `only ${itemCount} items in the feed; expected all content`);
	}
	if (!feed.includes('<link>https://')) {
		fail('/rss.xml', 'feed links are not absolute');
	}
}

// Required pages must exist.
const REQUIRED_PAGES = [
	'index.html',
	'404.html',
	'faq/index.html',
	'about/index.html',
	'contact/index.html',
	'thank-you/index.html',
	'privacy-policy/index.html',
	'recipes/index.html',
	'guides/index.html',
	'product-recommendations/index.html',
];
for (const page of REQUIRED_PAGES) {
	if (!existsSync(join(dist, page))) fail('/', `required page missing: ${page}`);
}

// Minimum content counts from the brief.
const count = (dir, exclude = 'index.html') =>
	existsSync(join(dist, dir))
		? readdirSync(join(dir === '' ? dist : join(dist, dir))).filter(
				(e) => e !== exclude && statSync(join(dist, dir, e)).isDirectory(),
			).length
		: 0;

const CONTENT_MINIMUMS = [
	['recipes', 6],
	['guides', 3],
	['product-recommendations', 1],
];
for (const [dir, min] of CONTENT_MINIMUMS) {
	const found = count(dir);
	if (found < min) fail('/', `expected at least ${min} ${dir}, found ${found}`);
}

// ------------------------------------------------------------ Internal links
// Every internal href must resolve to something actually in dist/ — a built
// page, an asset, or a Pages Function route.
const FUNCTION_ROUTES = ['/api/contact', '/api/subscribe'];

const seenBadLinks = new Set();
for (const { from, href } of internalLinks) {
	const clean = href.split('#')[0].split('?')[0];
	if (clean === '' || clean === '/') continue;
	if (FUNCTION_ROUTES.includes(clean)) continue;

	const target = clean.replace(/^\//, '');
	const candidates = [
		join(dist, target),
		join(dist, target, 'index.html'),
		join(dist, `${target}.html`),
	];

	if (!candidates.some((c) => existsSync(c))) {
		const key = `${from} -> ${href}`;
		if (!seenBadLinks.has(key)) {
			seenBadLinks.add(key);
			fail(from, `dead internal link: ${href}`);
		}
	}
}

// ------------------------------------------------------- Placeholder content
// Sample testimonials and unverified affiliate links must never reach a live
// site unnoticed: publishing invented reader stories as genuine would be both
// dishonest and an FTC endorsement-guide problem. Every flagged file is listed
// on every build until someone clears the flag.
const placeholders = [];
const contentRoot = join(root, 'src', 'content');

if (existsSync(contentRoot)) {
	const walk = (dir) => {
		for (const entry of readdirSync(dir)) {
			const full = join(dir, entry);
			if (statSync(full).isDirectory()) walk(full);
			else if (entry.endsWith('.md')) {
				const body = readFileSync(full, 'utf8');
				if (/^placeholder:\s*true\s*$/m.test(body)) {
					placeholders.push(relative(root, full));
				}
			}
		}
	};
	walk(contentRoot);
}

// ---------------------------------------------------------------------- Report
const w = (s, n) => String(s).padEnd(n);

console.log('\nGutWise — pre-launch site verification\n');
console.log(`  Pages checked: ${files.length}`);
console.log(`  Unique titles: ${titles.size}`);
console.log(`  Unique descriptions: ${descriptions.size}\n`);

if (warnings.length > 0) {
	console.log(`  ${warnings.length} warning(s):`);
	for (const { page, message } of warnings) {
		console.log(`    ! ${w(page, 46)} ${message}`);
	}
	console.log('');
}

if (placeholders.length > 0) {
	console.log('  ⚠ PLACEHOLDER CONTENT — must be replaced before this site goes public:');
	for (const file of placeholders) {
		console.log(`      ${file}`);
	}
	console.log(
		'    Anything flagged here is illustrative sample content, not verified\n' +
			'    fact. Publishing it as genuine would be dishonest — and for reader\n' +
			'    testimonials or paid links specifically, it breaches the FTC\n' +
			'    endorsement guides.\n' +
			'    Replace the content, then remove `placeholder: true` from the frontmatter.\n',
	);
}

if (errors.length > 0) {
	console.error(`  ${errors.length} error(s):`);
	for (const { page, message } of errors) {
		console.error(`    ✗ ${w(page, 46)} ${message}`);
	}
	console.error('\n✗ Verification failed.\n');
	process.exit(1);
}

console.log('✓ All checks passed.\n');
