/**
 * Site-wide constants. Single source of truth for anything that appears in more
 * than one template — titles, nav, schema.org identity, disclosure text.
 */

export const SITE = {
	name: 'GutWise',
	/** Used in <title> suffixes. Kept short so titles stay inside ~60 chars. */
	shortName: 'GutWise',
	tagline: 'Calm, evidence-based low-FODMAP guidance',
	description:
		'Low-FODMAP recipes, phase-by-phase guides and tested product picks for people managing IBS — calm, practical and grounded in the Monash protocol.',
	/** Falls back to the configured `site` in astro.config.mjs. */
	url: import.meta.env.SITE ?? 'https://gutwise.nexudel.com',
	locale: 'en_US',
	lang: 'en',
	email: 'hello@gutwise.nexudel.com',
	/** Promise rendered on the contact page and in the contact schema. */
	responseTimePromise: 'We respond within 1 business day.',
	founded: '2026',
} as const;

export const NAV_LINKS = [
	{ href: '/recipes/', label: 'Recipes' },
	{ href: '/guides/', label: 'Guides' },
	{ href: '/product-recommendations/', label: 'Product Picks' },
	{ href: '/faq/', label: 'FAQ' },
] as const;

export const FOOTER_LINKS = {
	Explore: [
		{ href: '/recipes/', label: 'All recipes' },
		{ href: '/guides/', label: 'Guides' },
		{ href: '/product-recommendations/', label: 'Product picks' },
		{ href: '/rss.xml', label: 'Subscribe by RSS' },
	],
	Start: [
		{ href: '/guides/what-is-the-low-fodmap-diet/', label: 'What is low-FODMAP?' },
		{ href: '/guides/low-fodmap-food-list/', label: 'The food list' },
		{ href: '/guides/elimination-phase-explained/', label: 'Elimination phase' },
		{ href: '/guides/reintroduction-protocol/', label: 'Reintroduction protocol' },
		{ href: '/faq/', label: 'Common questions' },
	],
	Site: [
		{ href: '/about/', label: 'About GutWise' },
		{ href: '/contact/', label: 'Contact' },
		{ href: '/privacy-policy/', label: 'Privacy policy' },
		{ href: '/funding/', label: 'How we are funded' },
	],
} as const;

/** The lead magnet. Referenced by every CTA on the site. */
export const LEAD_MAGNET = {
	title: 'Low-FODMAP Elimination Phase Starter Kit',
	shortTitle: 'Free Starter Kit',
	blurb:
		'A 14-page PDF: the full safe-foods list, a two-week meal plan, a printable symptom tracker and a shopping checklist you can take to the store.',
	cta: 'Get the Free Starter Kit',
	/**
	 * Built by scripts/generate-starter-kit.mjs, which hard-fails if the document
	 * is not exactly the 14 pages advertised above.
	 */
	file: '/downloads/gutwise-low-fodmap-starter-kit.pdf',
	fileSize: '36 KB',
	pages: 14,
} as const;

/**
 * Funding statement, shown above the fold on any page that recommends products.
 *
 * GutWise currently runs no affiliate programme, no sponsorship and no ads, so
 * this says exactly that. If that ever changes, the FTC endorsement guides
 * require a clear and conspicuous disclosure before the first paid link — a
 * footer mention does not meet that standard — and this text must be rewritten
 * to describe the real arrangement rather than softened.
 */
export const FUNDING_NOTE =
	'GutWise earns nothing from the products on this page. There are no affiliate links, no sponsored placements and no paid rankings — every link goes straight to the maker or to an ordinary retailer, and we get no commission if you buy. Several of the items below are supermarket staples we tell you not to spend extra on.';

/**
 * Medical disclaimer. Required on every page giving dietary guidance.
 */
export const MEDICAL_DISCLAIMER =
	'GutWise publishes educational information, not medical advice. The low-FODMAP diet is an elimination protocol designed to be followed short-term with support from a registered dietitian. Always speak to a qualified healthcare professional before changing your diet, particularly if you have not yet been formally diagnosed.';

/**
 * The three protocol phases. Used for recipe filtering, badges and guide
 * cross-linking. `order` drives sort; `slug` is the filter query value.
 */
export const PHASES = [
	{
		slug: 'elimination',
		label: 'Elimination',
		order: 1,
		blurb: 'Strictly low-FODMAP. Weeks 1–6, to settle symptoms to a baseline.',
	},
	{
		slug: 'reintroduction',
		label: 'Reintroduction',
		order: 2,
		blurb: 'Structured challenges, one FODMAP group at a time, to find your triggers.',
	},
	{
		slug: 'maintenance',
		label: 'Maintenance',
		order: 3,
		blurb: 'Your long-term personalised diet — as broad as your gut allows.',
	},
] as const;

export type PhaseSlug = (typeof PHASES)[number]['slug'];

export const MEAL_TYPES = [
	'breakfast',
	'lunch',
	'dinner',
	'snack',
	'side',
	'dessert',
] as const;

export type MealType = (typeof MEAL_TYPES)[number];

/**
 * FODMAP safety levels. Every level pairs a colour with BOTH an icon and a text
 * label — WCAG 1.4.1 forbids conveying meaning through colour alone, and this
 * audience in particular must never have to guess from a coloured dot.
 */
export const FODMAP_LEVELS = {
	safe: {
		label: 'Low FODMAP',
		icon: 'check',
		description: 'Safe at the serving size listed.',
	},
	moderate: {
		label: 'Portion-dependent',
		icon: 'scale',
		description: 'Low FODMAP only up to the serving size listed — larger servings stack.',
	},
	high: {
		label: 'High FODMAP',
		icon: 'alert',
		description: 'Avoid during elimination. Save for a structured reintroduction challenge.',
	},
} as const;

export type FodmapLevel = keyof typeof FODMAP_LEVELS;
