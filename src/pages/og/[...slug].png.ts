import type { APIRoute, GetStaticPaths } from 'astro';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { ogEntries, type OgEntry } from '../../lib/og';
import { SITE } from '../../consts';

/**
 * Build-time Open Graph image generation.
 *
 * Rendered with satori (JSX-free object form) into SVG, then rasterised to PNG
 * by resvg. Fonts are read from node_modules and embedded, so rendering is
 * deterministic on any build machine and needs no system fonts installed.
 *
 * This is a static endpoint: every image is written to dist/ at build time and
 * served as a plain file. Nothing runs at request time.
 */

const require = createRequire(import.meta.url);

const fontRegular = readFileSync(
	require.resolve('@fontsource/inter/files/inter-latin-400-normal.woff'),
);
const fontSemibold = readFileSync(
	require.resolve('@fontsource/inter/files/inter-latin-600-normal.woff'),
);
const fontBold = readFileSync(
	require.resolve('@fontsource/inter/files/inter-latin-700-normal.woff'),
);

// Mirrors the design tokens in src/styles/global.css.
const CREAM = '#FAF7F2';
const SAGE_DEEP = '#2F4A3C';
const SAGE = '#4C7361';
const SAGE_LIGHT = '#7FA88F';
const INK_MUTED = '#514A42';

/** Long titles need a smaller size to stay on three lines or fewer. */
function titleSize(title: string): number {
	if (title.length > 68) return 52;
	if (title.length > 48) return 60;
	return 70;
}

function template(entry: OgEntry) {
	return {
		type: 'div',
		props: {
			style: {
				display: 'flex',
				flexDirection: 'column',
				width: '100%',
				height: '100%',
				backgroundColor: CREAM,
				padding: '64px 72px',
				fontFamily: 'Inter',
				position: 'relative',
			},
			children: [
				// Sage rule down the left edge — the brand's quiet signature.
				{
					type: 'div',
					props: {
						style: {
							position: 'absolute',
							left: 0,
							top: 0,
							width: 16,
							height: '100%',
							backgroundColor: SAGE_DEEP,
							display: 'flex',
						},
					},
				},
				// Eyebrow
				{
					type: 'div',
					props: {
						style: {
							display: 'flex',
							fontSize: 26,
							fontWeight: 600,
							color: SAGE,
							letterSpacing: 2,
							textTransform: 'uppercase',
						},
						children: entry.eyebrow,
					},
				},
				// Title
				{
					type: 'div',
					props: {
						style: {
							display: 'flex',
							flexGrow: 1,
							alignItems: 'center',
							fontSize: titleSize(entry.title),
							fontWeight: 700,
							color: SAGE_DEEP,
							lineHeight: 1.15,
							letterSpacing: -1,
							marginTop: 24,
						},
						children: entry.title,
					},
				},
				// Footer row: wordmark + kicker
				{
					type: 'div',
					props: {
						style: {
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'space-between',
							borderTop: `3px solid ${SAGE_LIGHT}`,
							paddingTop: 28,
							marginTop: 24,
						},
						children: [
							{
								type: 'div',
								props: {
									style: {
										display: 'flex',
										fontSize: 34,
										fontWeight: 700,
										color: SAGE_DEEP,
										letterSpacing: -0.5,
									},
									children: SITE.name,
								},
							},
							{
								type: 'div',
								props: {
									style: {
										display: 'flex',
										fontSize: 26,
										fontWeight: 400,
										color: INK_MUTED,
									},
									children: entry.kicker,
								},
							},
						],
					},
				},
			],
		},
	};
}

export const getStaticPaths: GetStaticPaths = async () => {
	const entries = await ogEntries();
	return entries.map((entry) => ({
		params: { slug: entry.slug },
		props: { entry },
	}));
};

export const GET: APIRoute = async ({ props }) => {
	const entry = props.entry as OgEntry;

	const svg = await satori(template(entry) as never, {
		width: 1200,
		height: 630,
		fonts: [
			{ name: 'Inter', data: fontRegular, weight: 400, style: 'normal' },
			{ name: 'Inter', data: fontSemibold, weight: 600, style: 'normal' },
			{ name: 'Inter', data: fontBold, weight: 700, style: 'normal' },
		],
	});

	const png = new Resvg(svg, {
		fitTo: { mode: 'width', value: 1200 },
	})
		.render()
		.asPng();

	return new Response(new Uint8Array(png), {
		headers: {
			'Content-Type': 'image/png',
			'Cache-Control': 'public, max-age=31536000, immutable',
		},
	});
};
