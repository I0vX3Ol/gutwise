import { defineCollection } from 'astro:content';
// `z` re-exported from 'astro:content' is deprecated and slated for removal.
import { z } from 'astro/zod';
import { glob, file } from 'astro/loaders';

/**
 * Shared SEO fields. Lengths are asserted here so a badly-sized title or meta
 * description fails the build rather than shipping and quietly costing CTR.
 * scripts/verify-site.mjs re-checks the rendered output as a second gate.
 */
const seo = {
	/** Rendered as the <h1> and, by default, as the base of the <title>. */
	title: z.string().min(10).max(70),
	/**
	 * Overrides `title` in the <title> tag only. Use when a good headline is
	 * longer than a good search title — the brand suffix adds ~10 characters and
	 * the whole thing needs to stay under 60.
	 */
	seoTitle: z.string().min(10).max(50).optional(),
	/** The <meta name="description">. Should read as a promise plus a CTA. */
	description: z.string().min(70).max(165),
	/** Short dek shown on index cards — not the meta description. */
	summary: z.string().min(40).max(200),
	image: z.string().default('/images/og-default.svg'),
	imageAlt: z.string().min(10),
	publishDate: z.coerce.date(),
	updatedDate: z.coerce.date().optional(),
	draft: z.boolean().default(false),
	/**
	 * Marks illustrative sample content that must be replaced before the site
	 * goes public. `npm run check:site` lists every flagged file on each build,
	 * so placeholder testimonials or unverified affiliate links cannot ship by
	 * accident.
	 */
	placeholder: z.boolean().default(false),
};

const phaseEnum = z.enum(['elimination', 'reintroduction', 'maintenance']);
const mealTypeEnum = z.enum([
	'breakfast',
	'lunch',
	'dinner',
	'snack',
	'side',
	'dessert',
]);
const fodmapLevel = z.enum(['safe', 'moderate', 'high']);

/** Reusable Q&A shape — drives both the rendered accordion and FAQPage schema. */
const faqItem = z.object({
	question: z.string().min(10),
	answer: z.string().min(40),
});

const recipes = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/content/recipes' }),
	schema: z.object({
		...seo,
		/** A recipe can be safe in more than one phase; drives index filtering. */
		phases: z.array(phaseEnum).min(1),
		mealTypes: z.array(mealTypeEnum).min(1),
		prepMinutes: z.number().int().positive(),
		cookMinutes: z.number().int().nonnegative(),
		servings: z.number().int().positive(),
		yieldLabel: z.string().default('servings'),
		cuisine: z.string().optional(),
		/** Free-text guidance on why this recipe is gut-friendly. */
		fodmapNotes: z.string().min(40),
		/** The portion ceiling that keeps the dish low-FODMAP. */
		servingSizeNote: z.string().min(20),
		ingredients: z
			.array(
				z.object({
					amount: z.string(),
					item: z.string(),
					/** Per-ingredient FODMAP flag; renders icon + text, never colour alone. */
					fodmap: fodmapLevel.default('safe'),
					note: z.string().optional(),
				}),
			)
			.min(3),
		instructions: z.array(z.string().min(15)).min(2),
		tips: z.array(z.string()).default([]),
		nutrition: z
			.object({
				calories: z.string().optional(),
				protein: z.string().optional(),
				carbs: z.string().optional(),
				fat: z.string().optional(),
				fiber: z.string().optional(),
			})
			.optional(),
		featured: z.boolean().default(false),
		/** Slugs of related guides — powers the guides <-> recipes internal mesh. */
		relatedGuides: z.array(z.string()).default([]),
	}),
});

const guides = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/content/guides' }),
	schema: z.object({
		...seo,
		phase: phaseEnum.optional(),
		/** Controls order in the index and in "next guide" navigation. */
		order: z.number().int().default(99),
		readingMinutes: z.number().int().positive(),
		featured: z.boolean().default(false),
		/** Rendered as an accordion AND emitted as FAQPage schema on the guide. */
		faqs: z.array(faqItem).default([]),
		/** Named sources shown in a "How we know this" block. */
		sources: z
			.array(z.object({ label: z.string(), url: z.string().url() }))
			.default([]),
		relatedRecipes: z.array(z.string()).default([]),
		relatedGuides: z.array(z.string()).default([]),
	}),
});

const products = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/content/products' }),
	schema: z.object({
		...seo,
		/** Every pick carries its own affiliate URL and rationale. */
		picks: z
			.array(
				z.object({
					name: z.string(),
					brand: z.string(),
					bestFor: z.string(),
					why: z.string().min(40),
					watchOut: z.string().optional(),
					priceBand: z.enum(['$', '$$', '$$$']),
					retailer: z.string(),
					affiliateUrl: z.string().url(),
					/** e.g. "Monash certified", "FODMAP Friendly certified". */
					certification: z.string().optional(),
					fodmap: fodmapLevel.default('safe'),
				}),
			)
			.min(3),
		lastReviewed: z.coerce.date(),
		featured: z.boolean().default(false),
		faqs: z.array(faqItem).default([]),
		relatedGuides: z.array(z.string()).default([]),
	}),
});

const stories = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/content/stories' }),
	schema: z.object({
		...seo,
		/** First name only — these are reader stories, not case files. */
		personName: z.string(),
		location: z.string(),
		/** How long they had been symptomatic before starting. */
		background: z.string().min(30),
		timeframe: z.string(),
		phase: phaseEnum,
		/** Pull-quote rendered large at the top of the story. */
		quote: z.string().min(40).max(320),
		outcomes: z.array(z.string()).min(2),
		/** Triggers identified during reintroduction. */
		triggersFound: z.array(z.string()).default([]),
		featured: z.boolean().default(false),
		relatedGuides: z.array(z.string()).default([]),
	}),
});

/**
 * Site-wide FAQ. A data collection rather than markdown — these are consumed
 * both as rendered accordion items and as FAQPage structured data.
 */
const faqs = defineCollection({
	loader: file('./src/data/faqs.json'),
	schema: z.object({
		id: z.string(),
		question: z.string().min(10),
		answer: z.string().min(60),
		category: z.enum(['basics', 'phases', 'food', 'practical', 'products']),
		order: z.number().int(),
	}),
});

export const collections = { recipes, guides, products, stories, faqs };
