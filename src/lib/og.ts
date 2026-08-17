import { getCollection } from 'astro:content';
import { byRecency, publishedOnly, formatDuration } from './utils';

/**
 * Per-page Open Graph images.
 *
 * The brief calls for a custom social image on every major page rather than one
 * generic file, so each page gets a PNG rendered at build time by
 * src/pages/og/[...slug].png.ts.
 *
 * `ogPathFor()` and `ogEntries()` must agree: the former is what templates link
 * to, the latter is what actually gets rendered. scripts/verify-site.mjs asserts
 * that every referenced OG image exists in dist/, which catches any drift.
 */

export type OgEntry = {
	/** Route-like slug, no leading or trailing slash. `index` for the home page. */
	slug: string;
	eyebrow: string;
	title: string;
	kicker: string;
};

/** Maps a page pathname to its generated OG image URL. */
export function ogPathFor(pathname: string): string {
	const clean = pathname.replace(/^\/+|\/+$/g, '');
	return `/og/${clean === '' ? 'index' : clean}.png`;
}

/** Pages that are not driven by a content collection. */
const STATIC_ENTRIES: OgEntry[] = [
	{
		slug: 'index',
		eyebrow: 'Low-FODMAP, without the panic',
		title: 'Calm, evidence-based help for living with IBS',
		kicker: 'Recipes, phase guides and honest product picks',
	},
	{
		slug: 'recipes',
		eyebrow: 'Recipe index',
		title: 'Low-FODMAP recipes with tested portion limits',
		kicker: 'Filter by protocol phase and meal type',
	},
	{
		slug: 'guides',
		eyebrow: 'Guides',
		title: 'The low-FODMAP protocol, explained properly',
		kicker: 'Elimination, reintroduction and what comes after',
	},
	{
		slug: 'product-recommendations',
		eyebrow: 'Product picks',
		title: 'What is actually worth buying — and what is not',
		kicker: 'Independently chosen, honestly ranked',
	},
	{
		slug: 'faq',
		eyebrow: 'Frequently asked questions',
		title: 'Straight answers to the questions people ask first',
		kicker: 'Phases, portions, products and practicalities',
	},
	{
		slug: 'about',
		eyebrow: 'About GutWise',
		title: 'Why this site exists and how we work',
		kicker: 'Our editorial standards and funding, stated plainly',
	},
	{
		slug: 'contact',
		eyebrow: 'Contact',
		title: 'Get in touch with the GutWise team',
		kicker: 'We respond within 1 business day',
	},
	{
		slug: 'privacy-policy',
		eyebrow: 'Privacy',
		title: 'How GutWise handles your data',
		kicker: 'What we collect, why, and how to remove it',
	},
	{
		slug: 'funding',
		eyebrow: 'Transparency',
		title: 'How GutWise is funded',
		kicker: 'No affiliate links, no sponsorship, no ads',
	},
	{
		slug: 'thank-you',
		eyebrow: 'Thank you',
		title: 'Your Starter Kit is on its way',
		kicker: 'Check your inbox for the download link',
	},
	{
		slug: '404',
		eyebrow: 'Page not found',
		title: 'That page has moved or never existed',
		kicker: 'Search, or start from a popular recipe',
	},
];

/** Every OG image the build should produce. */
export async function ogEntries(): Promise<OgEntry[]> {
	const [recipes, guides, products] = await Promise.all([
		getCollection('recipes'),
		getCollection('guides'),
		getCollection('products'),
	]);

	const recipeEntries = publishedOnly(recipes)
		.sort(byRecency)
		.map((r) => ({
			slug: `recipes/${r.id}`,
			eyebrow: 'Recipe',
			title: r.data.title,
			kicker: `${formatDuration(r.data.prepMinutes + r.data.cookMinutes)} · Serves ${r.data.servings}`,
		}));

	const guideEntries = publishedOnly(guides)
		.sort((a, b) => a.data.order - b.data.order)
		.map((g) => ({
			slug: `guides/${g.id}`,
			eyebrow: 'Guide',
			title: g.data.title,
			kicker: `${g.data.readingMinutes} min read`,
		}));

	const productEntries = publishedOnly(products)
		.sort(byRecency)
		.map((p) => ({
			slug: `product-recommendations/${p.id}`,
			eyebrow: 'Product picks',
			title: p.data.title,
			kicker: `${p.data.picks.length} recommendations, independently chosen`,
		}));

	return [
		...STATIC_ENTRIES,
		...recipeEntries,
		...guideEntries,
		...productEntries,
	];
}
