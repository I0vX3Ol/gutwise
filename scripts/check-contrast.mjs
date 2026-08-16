#!/usr/bin/env node
/**
 * WCAG 2.1 contrast verification for the GutWise palette.
 *
 * The brand direction is sage-on-cream, which is exactly the combination that
 * tends to fail at lighter tints — so every token pair that ships as text or as
 * a UI boundary is asserted here and enforced in CI.
 *
 * Run: npm run check:contrast
 */

const TOKENS = {
	// Surfaces
	cream: '#FAF7F2',
	creamSunken: '#F2EDE4',
	white: '#FFFFFF',
	sageDeep: '#2F4A3C',
	sageDark: '#3C5C4B',

	// Ink
	ink: '#241F1A',
	inkMuted: '#514A42',

	// Brand sage
	sage: '#4C7361',
	sageMid: '#5C8A72',
	sageLight: '#7FA88F',
	sageWash: '#E8F0EA',

	// Trust blue
	blue: '#3C5A73',
	blueOnDark: '#A8C6DE',

	// Utility (deliberately soft amber, never alarm red — see brand notes)
	amber: '#7A5312',
	amberWash: '#FBF0DC',
	clay: '#8A4B3C',
	clayWash: '#F7E9E5',
};

/** Relative luminance per WCAG 2.1 §Relative luminance. */
function luminance(hex) {
	const [r, g, b] = hex
		.replace('#', '')
		.match(/../g)
		.map((h) => {
			const c = parseInt(h, 16) / 255;
			return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
		});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
	const l1 = luminance(a);
	const l2 = luminance(b);
	return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/**
 * Every pair the site actually renders.
 * min 4.5 = body text (AA), 3.0 = large text (>=24px or >=18.66px bold) and
 * non-text UI components / focus indicators (AA).
 */
const PAIRS = [
	// --- Body copy on the cream page background ---
	['ink', 'cream', 4.5, 'body text on page background'],
	['inkMuted', 'cream', 4.5, 'muted body text / captions on page background'],
	['ink', 'creamSunken', 4.5, 'body text on sunken card background'],
	['inkMuted', 'creamSunken', 4.5, 'muted text on sunken card background'],
	['ink', 'white', 4.5, 'body text on white card'],
	['inkMuted', 'white', 4.5, 'muted text on white card'],

	// --- Sage as text (the risky one the brief calls out explicitly) ---
	['sage', 'cream', 4.5, 'sage body text on cream'],
	['sage', 'white', 4.5, 'sage body text on white'],
	['sage', 'creamSunken', 4.5, 'sage text on sunken card'],
	['sageDeep', 'cream', 4.5, 'heading sage on cream'],
	['sageDeep', 'white', 4.5, 'heading sage on white'],
	['sageDeep', 'sageWash', 4.5, 'heading sage on sage wash panel'],
	['sage', 'sageWash', 4.5, 'sage text on sage wash panel'],

	// --- Trust blue links ---
	['blue', 'cream', 4.5, 'link blue on cream'],
	['blue', 'white', 4.5, 'link blue on white'],
	['blue', 'creamSunken', 4.5, 'link blue on sunken card'],
	['blue', 'sageWash', 4.5, 'link blue on sage wash panel'],

	// --- Inverted surfaces (footer, hero panel, primary buttons) ---
	['cream', 'sageDeep', 4.5, 'cream text on deep sage surface'],
	['white', 'sageDeep', 4.5, 'white text on deep sage surface'],
	['cream', 'sageDark', 4.5, 'cream text on dark sage surface'],
	['white', 'sage', 4.5, 'white button label on sage button'],
	['blueOnDark', 'sageDeep', 4.5, 'link on deep sage footer'],

	// --- FODMAP / utility tags (icon + text, never colour alone) ---
	['sageDeep', 'sageWash', 4.5, 'FODMAP-safe tag text'],
	['amber', 'amberWash', 4.5, 'moderate-portion tag text'],
	['clay', 'clayWash', 4.5, 'high-FODMAP tag text'],
	['amber', 'cream', 4.5, 'amber inline text on cream'],
	['clay', 'cream', 4.5, 'clay inline text on cream'],

	// --- Non-text UI: focus ring, borders, controls (3:1) ---
	['sageDeep', 'cream', 3.0, 'focus ring against page background'],
	['sageDeep', 'white', 3.0, 'focus ring against white card'],
	['sage', 'cream', 3.0, 'button/input border on cream'],
	['sageLight', 'sageDeep', 3.0, 'decorative rule on deep sage surface'],
];

let failed = 0;
const rows = [];

for (const [fgKey, bgKey, min, label] of PAIRS) {
	const fg = TOKENS[fgKey];
	const bg = TOKENS[bgKey];
	if (!fg || !bg) {
		console.error(`Unknown token in pair: ${fgKey} / ${bgKey}`);
		failed++;
		continue;
	}
	const ratio = contrast(fg, bg);
	const pass = ratio >= min;
	if (!pass) failed++;
	rows.push({
		status: pass ? 'PASS' : 'FAIL',
		ratio: ratio.toFixed(2),
		min: min.toFixed(1),
		pair: `${fgKey} on ${bgKey}`,
		label,
	});
}

const w = (s, n) => String(s).padEnd(n);
console.log('\nGutWise palette — WCAG 2.1 AA contrast verification\n');
console.log(
	`  ${w('', 4)} ${w('ratio', 7)} ${w('min', 5)} ${w('pair', 26)} description`,
);
console.log(`  ${'-'.repeat(88)}`);
for (const r of rows) {
	console.log(
		`  ${w(r.status, 4)} ${w(r.ratio + ':1', 7)} ${w(r.min, 5)} ${w(r.pair, 26)} ${r.label}`,
	);
}

console.log('');
if (failed > 0) {
	console.error(`✗ ${failed} of ${rows.length} colour pairs fail WCAG 2.1 AA.\n`);
	process.exit(1);
}
console.log(`✓ All ${rows.length} colour pairs meet WCAG 2.1 AA.\n`);
