#!/usr/bin/env node
/**
 * Generates on-brand SVG placeholder imagery.
 *
 * These stand in for the real food photography the brand direction calls for.
 * They are deliberately abstract rather than fake photos, and every one is
 * meant to be replaced — see the "Replacing the placeholder imagery" section of
 * the README.
 *
 * The alt text in src/content/ describes the *intended photograph*, not these
 * placeholders, because that is the text that ships once the real images land.
 *
 * Run: node scripts/generate-placeholders.mjs
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'images');

const C = {
	cream: '#FAF7F2',
	creamSunken: '#F2EDE4',
	sageDeep: '#2F4A3C',
	sage: '#4C7361',
	sageMid: '#5C8A72',
	sageLight: '#7FA88F',
	sageWash: '#E8F0EA',
	amber: '#D8B26A',
	clay: '#C08A76',
};

/** Simple deterministic hash so each slug gets a stable arrangement. */
function hash(str) {
	let h = 2166136261;
	for (let i = 0; i < str.length; i++) {
		h ^= str.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return Math.abs(h);
}

/**
 * An abstract overhead "bowl" composition. Varies by slug so the index pages do
 * not look like the same tile repeated.
 */
function bowlScene(slug, accent) {
	const h = hash(slug);
	const cx = 320;
	const cy = 200;
	const r = 118;

	// Scatter a few "ingredient" marks around the bowl, deterministically.
	const marks = Array.from({ length: 7 }, (_, i) => {
		const angle = ((h >> (i * 3)) % 360) * (Math.PI / 180);
		const dist = 34 + ((h >> (i * 2)) % 52);
		const rad = 9 + ((h >> i) % 11);
		const x = (cx + Math.cos(angle) * dist).toFixed(1);
		const y = (cy + Math.sin(angle) * dist).toFixed(1);
		const fill = [accent, C.sageLight, C.sageMid][(h >> (i + 1)) % 3];
		const opacity = 0.55 + ((h >> i) % 30) / 100;
		return `<circle cx="${x}" cy="${y}" r="${rad}" fill="${fill}" opacity="${opacity.toFixed(2)}"/>`;
	}).join('');

	return `
    <circle cx="${cx}" cy="${cy}" r="${r + 14}" fill="${C.sageWash}" opacity="0.75"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#FFFFFF"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${C.sageLight}" stroke-width="3" opacity="0.7"/>
    ${marks}
    <circle cx="${cx}" cy="${cy}" r="${r - 26}" fill="none" stroke="${C.sageMid}" stroke-width="2" opacity="0.35"/>`;
}

/** Abstract document/diagram motif for guides and editorial pages. */
function documentScene(slug, accent) {
	const h = hash(slug);
	const lines = Array.from({ length: 5 }, (_, i) => {
		const w = 150 + ((h >> (i * 4)) % 130);
		return `<rect x="238" y="${146 + i * 26}" width="${w}" height="9" rx="4.5" fill="${
			i === 0 ? accent : C.sageLight
		}" opacity="${i === 0 ? 0.9 : 0.5}"/>`;
	}).join('');

	return `
    <rect x="206" y="96" width="228" height="208" rx="14" fill="#FFFFFF" stroke="${C.sageLight}" stroke-width="3"/>
    <rect x="238" y="122" width="92" height="12" rx="6" fill="${C.sage}" opacity="0.85"/>
    ${lines}
    <circle cx="392" cy="272" r="20" fill="${accent}" opacity="0.85"/>
    <path d="M384 272l6 6 11-12" fill="none" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function build({ slug, scene, accent }) {
	const inner = scene === 'document' ? documentScene(slug, accent) : bowlScene(slug, accent);

	// role="presentation" — the meaningful description lives in each page's alt
	// attribute, so the SVG itself must not announce anything of its own.
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400" width="640" height="400" role="presentation">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${C.cream}"/>
      <stop offset="100%" stop-color="${C.creamSunken}"/>
    </linearGradient>
  </defs>
  <rect width="640" height="400" fill="url(#bg)"/>
  <rect x="0" y="0" width="640" height="6" fill="${C.sageDeep}"/>
  ${inner}
</svg>
`;
}

const IMAGES = [
	// Recipes
	{ path: 'recipes/lemon-herb-chicken.svg', scene: 'bowl', accent: C.amber },
	{ path: 'recipes/overnight-oats.svg', scene: 'bowl', accent: C.clay },
	{ path: 'recipes/tomato-basil-pasta.svg', scene: 'bowl', accent: C.clay },
	{ path: 'recipes/ginger-carrot-soup.svg', scene: 'bowl', accent: C.amber },
	{ path: 'recipes/energy-bites.svg', scene: 'bowl', accent: C.amber },
	{ path: 'recipes/salmon-bok-choy.svg', scene: 'bowl', accent: C.clay },
	{ path: 'recipes/quinoa-bowl.svg', scene: 'bowl', accent: C.sageMid },

	// Guides
	{ path: 'guides/what-is-low-fodmap.svg', scene: 'document', accent: C.sage },
	{ path: 'guides/elimination-phase.svg', scene: 'document', accent: C.amber },
	{ path: 'guides/reintroduction.svg', scene: 'document', accent: C.sageMid },

	// Products
	{ path: 'products/pantry-starter.svg', scene: 'document', accent: C.clay },

	// Stories
	{ path: 'stories/maria.svg', scene: 'bowl', accent: C.sageMid },
	{ path: 'stories/james.svg', scene: 'bowl', accent: C.sage },

	// Generic fallback referenced by the content schema default
	{ path: 'og-default.svg', scene: 'document', accent: C.sage },
];

for (const image of IMAGES) {
	const file = join(out, image.path);
	mkdirSync(dirname(file), { recursive: true });
	writeFileSync(file, build({ ...image, slug: image.path }));
}

// The logo doubles as the schema.org Organization logo, so it is square.
const logo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-label="GutWise">
  <rect width="512" height="512" rx="112" fill="${C.sageDeep}"/>
  <path d="M232 400A150 150 0 0 1 82 250c0-129 150-193 343-193 0 193-86 343-193 343Z" fill="none" stroke="${C.cream}" stroke-width="30" stroke-linejoin="round"/>
  <path d="M82 422c64-129 129-193 257-257" fill="none" stroke="${C.sageLight}" stroke-width="30" stroke-linecap="round"/>
</svg>
`;
writeFileSync(join(out, 'gutwise-logo.svg'), logo);

// The favicon is the same mark, served from the site root.
writeFileSync(join(root, 'public', 'favicon.svg'), logo);

// Raster icons, all rasterised from the same mark so they cannot drift apart:
//  - 180px for the iOS home-screen icon
//  - 48px for Google Search, which wants a favicon that is a multiple of 48
const { Resvg } = await import('@resvg/resvg-js');

const raster = (size) =>
	new Resvg(logo, { fitTo: { mode: 'width', value: size } }).render().asPng();

writeFileSync(join(root, 'public', 'apple-touch-icon.png'), raster(180));
writeFileSync(join(root, 'public', 'favicon-48.png'), raster(48));
writeFileSync(join(root, 'public', 'favicon-96.png'), raster(96));

console.log(
	`✓ Generated ${IMAGES.length + 1} placeholder images, favicon.svg and 3 raster icons`,
);
