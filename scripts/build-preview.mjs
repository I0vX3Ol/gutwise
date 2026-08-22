#!/usr/bin/env node
/**
 * Rewrites a built dist/ for the GitHub Pages preview.
 *
 * GutWise is built for Cloudflare Pages at the root of gutwise.nexudel.com.
 * The preview is served from a sub-path (…github.io/gutwise/), so every
 * root-relative URL needs the prefix. Astro's `base` option only covers the
 * assets it emits itself, not the hand-written links in the templates, so the
 * whole rewrite happens here instead — one rule applied uniformly, which
 * cannot double-prefix the way mixing the two approaches would.
 *
 * This runs ONLY in the preview workflow. Nothing here touches src/, and the
 * production build is unaffected.
 *
 * The preview must never compete with the real site in search, so it is also
 * forced to noindex at both the page and site level. Canonical tags are left
 * pointing at gutwise.nexudel.com deliberately — combined with noindex that is
 * belt and braces.
 *
 * Usage: node scripts/build-preview.mjs /gutwise
 */

import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const base = (process.argv[2] || '').replace(/\/+$/, '');
if (!base.startsWith('/')) {
	console.error('Usage: node scripts/build-preview.mjs /base-path');
	process.exit(1);
}

const dist = 'dist';
if (!existsSync(dist)) {
	console.error(`No ${dist}/ directory — run the build first.`);
	process.exit(1);
}

function walk(dir) {
	const out = [];
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) out.push(...walk(full));
		else out.push(full);
	}
	return out;
}

const files = walk(dist);
let htmlCount = 0;
let cssCount = 0;
let linkCount = 0;

/**
 * Prefixes root-relative URLs. Protocol-relative (`//cdn…`) is left alone, as
 * is anything already carrying the prefix, so the transform is idempotent.
 */
function prefix(source, attr) {
	const re = new RegExp(`${attr}="/(?!/)`, 'g');
	return source.replace(re, (match) => {
		linkCount++;
		return `${attr}="${base}/`;
	});
}

const BANNER = `<div style="background:#2F4A3C;color:#FAF7F2;padding:10px 16px;font:600 14px/1.45 system-ui,sans-serif;text-align:center">
Preview build — the live site will be at <strong>gutwise.nexudel.com</strong>. Forms and security headers are inactive here.
</div>`;

for (const file of files) {
	const ext = extname(file);

	if (ext === '.html') {
		let html = readFileSync(file, 'utf8');

		// Skip if already processed, so a re-run cannot double-prefix.
		if (html.includes(`href="${base}/`)) continue;

		html = prefix(html, 'href');
		html = prefix(html, 'src');

		// Force noindex. Every page already carries a robots meta, so replace it
		// rather than appending a second, contradictory one.
		if (/<meta name="robots"[^>]*>/.test(html)) {
			html = html.replace(
				/<meta name="robots"[^>]*>/,
				'<meta name="robots" content="noindex, nofollow">',
			);
		} else {
			html = html.replace('</head>', '<meta name="robots" content="noindex, nofollow"></head>');
		}

		// Say plainly what this is, so a preview URL is never mistaken for live.
		html = html.replace(/(<body[^>]*>)/, `$1${BANNER}`);

		writeFileSync(file, html);
		htmlCount++;
	} else if (ext === '.css') {
		// Font faces reference /_astro/*.woff2 from inside the stylesheet.
		const css = readFileSync(file, 'utf8');
		if (css.includes('url(/') && !css.includes(`url(${base}/`)) {
			writeFileSync(file, css.replace(/url\(\/(?!\/)/g, `url(${base}/`));
			cssCount++;
		}
	} else if (file.endsWith('site.webmanifest')) {
		const m = readFileSync(file, 'utf8');
		writeFileSync(file, m.replace(/"\/(?!\/)/g, `"${base}/`));
	}
}

// Keep the preview out of search entirely, as a second line of defence.
writeFileSync(
	join(dist, 'robots.txt'),
	`# Preview build — not the canonical site.\n` +
		`# The real site is https://gutwise.nexudel.com and this copy must never\n` +
		`# compete with it in search.\n\nUser-agent: *\nDisallow: /\n`,
);

// GitHub Pages runs Jekyll over the artifact unless told not to, and Jekyll
// silently drops files and directories whose names begin with an underscore —
// which here would be the entire /_astro/ bundle.
writeFileSync(join(dist, '.nojekyll'), '');

console.log(
	`✓ Preview rewrite complete: ${htmlCount} HTML files, ${cssCount} stylesheets, ` +
		`${linkCount} URLs prefixed with "${base}", robots.txt locked down, .nojekyll written.`,
);
