import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { SITE } from '../consts';
import { byRecency, publishedOnly } from '../lib/utils';

/**
 * Combined feed across recipes, guides and product roundups.
 *
 * One feed rather than four: the site publishes at a low enough volume that
 * splitting it would leave every feed looking abandoned, and readers who want a
 * single category can filter on the category element.
 */
export const GET: APIRoute = async (context) => {
	const site = context.site ?? new URL(SITE.url);

	const [recipes, guides, products] = await Promise.all([
		getCollection('recipes'),
		getCollection('guides'),
		getCollection('products'),
	]);

	const items = [
		...publishedOnly(recipes).map((entry) => ({
			entry,
			link: `/recipes/${entry.id}/`,
			category: 'Recipes',
		})),
		...publishedOnly(guides).map((entry) => ({
			entry,
			link: `/guides/${entry.id}/`,
			category: 'Guides',
		})),
		...publishedOnly(products).map((entry) => ({
			entry,
			link: `/product-recommendations/${entry.id}/`,
			category: 'Product picks',
		})),
	].sort((a, b) => byRecency(a.entry, b.entry));

	return rss({
		title: `${SITE.name} — ${SITE.tagline}`,
		description: SITE.description,
		site,
		trailingSlash: true,
		items: items.map(({ entry, link, category }) => ({
			title: entry.data.title,
			// The summary, not the meta description: a feed reader wants a human
			// dek, not a search snippet written to a character budget.
			description: entry.data.summary,
			pubDate: entry.data.publishDate,
			link,
			categories: [category],
		})),
		customData: `<language>en</language>
<copyright>© ${new Date().getFullYear()} ${SITE.name}</copyright>`,
	});
};
