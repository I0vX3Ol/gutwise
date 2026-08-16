/**
 * Structured-data builders.
 *
 * Every helper returns a plain object that gets serialised into a
 * <script type="application/ld+json"> block. Keeping them here rather than
 * inline in templates means the Organization/WebSite identity is defined once
 * and every page's @id references line up.
 */

import { SITE } from '../consts';

const abs = (path: string) =>
	new URL(path, SITE.url).href.replace(/([^:]\/)\/+/g, '$1');

/** Stable @id anchors so nodes can reference one another across the graph. */
export const IDS = {
	organization: `${SITE.url}/#organization`,
	website: `${SITE.url}/#website`,
};

export function organizationSchema() {
	return {
		'@type': 'Organization',
		'@id': IDS.organization,
		name: SITE.name,
		url: `${SITE.url}/`,
		description: SITE.description,
		email: SITE.email,
		foundingDate: SITE.founded,
		logo: {
			'@type': 'ImageObject',
			url: abs('/images/gutwise-logo.svg'),
			width: 512,
			height: 512,
		},
		knowsAbout: [
			'Low-FODMAP diet',
			'Irritable bowel syndrome',
			'Digestive health',
			'FODMAP reintroduction protocol',
		],
	};
}

export function websiteSchema() {
	return {
		'@type': 'WebSite',
		'@id': IDS.website,
		url: `${SITE.url}/`,
		name: SITE.name,
		description: SITE.description,
		publisher: { '@id': IDS.organization },
		inLanguage: SITE.lang,
	};
}

export type Crumb = { label: string; href: string };

export function breadcrumbSchema(crumbs: Crumb[]) {
	return {
		'@type': 'BreadcrumbList',
		itemListElement: crumbs.map((c, i) => ({
			'@type': 'ListItem',
			position: i + 1,
			name: c.label,
			item: abs(c.href),
		})),
	};
}

export function faqSchema(items: { question: string; answer: string }[]) {
	return {
		'@type': 'FAQPage',
		mainEntity: items.map((f) => ({
			'@type': 'Question',
			name: f.question,
			acceptedAnswer: { '@type': 'Answer', text: f.answer },
		})),
	};
}

/** Minutes -> ISO 8601 duration, which is what Recipe schema requires. */
export function isoDuration(minutes: number) {
	if (minutes <= 0) return 'PT0M';
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return `PT${h ? `${h}H` : ''}${m ? `${m}M` : ''}`;
}

type RecipeData = {
	title: string;
	description: string;
	image: string;
	imageAlt: string;
	publishDate: Date;
	updatedDate?: Date;
	prepMinutes: number;
	cookMinutes: number;
	servings: number;
	yieldLabel: string;
	cuisine?: string;
	mealTypes: readonly string[];
	phases: readonly string[];
	ingredients: readonly { amount: string; item: string }[];
	instructions: readonly string[];
	nutrition?: {
		calories?: string;
		protein?: string;
		carbs?: string;
		fat?: string;
		fiber?: string;
	};
};

export function recipeSchema(r: RecipeData, url: string) {
	const total = r.prepMinutes + r.cookMinutes;

	return {
		'@type': 'Recipe',
		'@id': `${abs(url)}#recipe`,
		name: r.title,
		description: r.description,
		image: [abs(r.image)],
		author: { '@id': IDS.organization },
		publisher: { '@id': IDS.organization },
		datePublished: r.publishDate.toISOString(),
		...(r.updatedDate && { dateModified: r.updatedDate.toISOString() }),
		prepTime: isoDuration(r.prepMinutes),
		cookTime: isoDuration(r.cookMinutes),
		totalTime: isoDuration(total),
		recipeYield: `${r.servings} ${r.yieldLabel}`,
		recipeCategory: r.mealTypes.join(', '),
		...(r.cuisine && { recipeCuisine: r.cuisine }),
		keywords: ['low FODMAP', ...r.phases, ...r.mealTypes].join(', '),
		suitableForDiet: 'https://schema.org/LowLactoseDiet',
		recipeIngredient: r.ingredients.map((i) =>
			`${i.amount} ${i.item}`.trim(),
		),
		recipeInstructions: r.instructions.map((step, i) => ({
			'@type': 'HowToStep',
			position: i + 1,
			text: step,
		})),
		...(r.nutrition && {
			nutrition: {
				'@type': 'NutritionInformation',
				servingSize: `1 of ${r.servings} ${r.yieldLabel}`,
				...(r.nutrition.calories && { calories: r.nutrition.calories }),
				...(r.nutrition.protein && { proteinContent: r.nutrition.protein }),
				...(r.nutrition.carbs && { carbohydrateContent: r.nutrition.carbs }),
				...(r.nutrition.fat && { fatContent: r.nutrition.fat }),
				...(r.nutrition.fiber && { fiberContent: r.nutrition.fiber }),
			},
		}),
	};
}

type ArticleData = {
	title: string;
	description: string;
	image: string;
	publishDate: Date;
	updatedDate?: Date;
};

export function articleSchema(a: ArticleData, url: string) {
	return {
		'@type': 'Article',
		'@id': `${abs(url)}#article`,
		headline: a.title,
		description: a.description,
		image: [abs(a.image)],
		author: { '@id': IDS.organization },
		publisher: { '@id': IDS.organization },
		datePublished: a.publishDate.toISOString(),
		...(a.updatedDate && { dateModified: a.updatedDate.toISOString() }),
		mainEntityOfPage: { '@type': 'WebPage', '@id': abs(url) },
		inLanguage: SITE.lang,
	};
}

export function contactPageSchema(url: string) {
	return {
		'@type': 'ContactPage',
		'@id': `${abs(url)}#contactpage`,
		name: `Contact ${SITE.name}`,
		url: abs(url),
		mainEntity: {
			'@type': 'Organization',
			'@id': IDS.organization,
			contactPoint: {
				'@type': 'ContactPoint',
				contactType: 'customer support',
				email: SITE.email,
				availableLanguage: ['English'],
			},
		},
	};
}

/**
 * Wraps any set of nodes in a single @graph so each page emits exactly one
 * JSON-LD block rather than several competing ones.
 */
export function graph(nodes: object[]) {
	return {
		'@context': 'https://schema.org',
		'@graph': nodes,
	};
}
