// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

/**
 * The canonical origin. Overridable so Cloudflare Pages preview branches build
 * with correct absolute URLs (canonical, OG tags, sitemap) instead of pointing
 * every preview at production.
 */
const site = process.env.SITE_URL ?? 'https://gutwise.nexudel.com';

// https://astro.build/config
export default defineConfig({
	site,
	output: 'static',
	trailingSlash: 'always',
	build: {
		format: 'directory',
	},
	// Astro strips the dev toolbar in production builds; this keeps it off in dev
	// too so nothing injects unexpected inline script during a11y auditing.
	devToolbar: { enabled: false },
	prefetch: {
		prefetchAll: true,
		defaultStrategy: 'hover',
	},
	integrations: [
		sitemap({
			// Pages with no search value or that exist purely as conversion
			// destinations stay out of the sitemap (they are noindex'd too).
			filter: (page) =>
				!page.includes('/thank-you/') && !page.includes('/404'),
			changefreq: 'weekly',
			// No global `lastmod`. Stamping every URL with the build time would
			// claim the whole site changed on every deploy, which is exactly how a
			// lastmod signal gets discounted. Better to omit it than to lie.
			serialize(item) {
				// Recipes and guides are the money pages; bias crawl priority.
				// Only `priority` is tuned per-URL — `changefreq` is set once above,
				// and Google has said publicly that it ignores the value anyway.
				if (item.url === `${site}/`) return { ...item, priority: 1.0 };
				if (item.url.includes('/recipes/') || item.url.includes('/guides/'))
					return { ...item, priority: 0.8 };
				if (
					item.url.includes('/privacy-policy/') ||
					item.url.includes('/affiliate-disclosure/')
				)
					return { ...item, priority: 0.2 };
				return { ...item, priority: 0.6 };
			},
		}),
	],
	vite: {
		plugins: [tailwindcss()],
		build: {
			// Keep the CSS in one file — the site is small and this avoids
			// render-blocking waterfalls on the critical path.
			cssCodeSplit: false,
		},
	},
});
