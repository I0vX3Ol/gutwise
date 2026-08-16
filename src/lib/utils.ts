import { PHASES, MEAL_TYPES, type PhaseSlug } from '../consts';

/** Human date for display. Always paired with a <time datetime> attribute. */
export function formatDate(date: Date): string {
	return new Intl.DateTimeFormat('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		timeZone: 'UTC',
	}).format(date);
}

/** Machine-readable date for <time datetime="...">. */
export function isoDate(date: Date): string {
	return date.toISOString().split('T')[0];
}

/** "1 hr 15 min" from total minutes. */
export function formatDuration(minutes: number): string {
	if (minutes < 60) return `${minutes} min`;
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return m ? `${h} hr ${m} min` : `${h} hr`;
}

export function phaseLabel(slug: string): string {
	return PHASES.find((p) => p.slug === slug)?.label ?? slug;
}

export function phaseBlurb(slug: string): string {
	return PHASES.find((p) => p.slug === slug)?.blurb ?? '';
}

/** Sorts phases into protocol order rather than the order authors listed them. */
export function sortPhases(phases: readonly string[]): string[] {
	return [...phases].sort(
		(a, b) =>
			(PHASES.find((p) => p.slug === a)?.order ?? 99) -
			(PHASES.find((p) => p.slug === b)?.order ?? 99),
	);
}

export function titleCase(value: string): string {
	return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Sorts meal types into the order you'd actually eat them. */
export function sortMealTypes(types: readonly string[]): string[] {
	return [...types].sort(
		(a, b) =>
			MEAL_TYPES.indexOf(a as never) - MEAL_TYPES.indexOf(b as never),
	);
}

export function isPhaseSlug(value: string): value is PhaseSlug {
	return PHASES.some((p) => p.slug === value);
}

/** Newest first, using updatedDate when present so refreshed posts resurface. */
export function byRecency<
	T extends { data: { publishDate: Date; updatedDate?: Date } },
>(a: T, b: T): number {
	const at = (a.data.updatedDate ?? a.data.publishDate).getTime();
	const bt = (b.data.updatedDate ?? b.data.publishDate).getTime();
	return bt - at;
}

/** Drops drafts in production while keeping them visible in `astro dev`. */
export function publishedOnly<T extends { data: { draft: boolean } }>(
	entries: T[],
): T[] {
	if (import.meta.env.DEV) return entries;
	return entries.filter((e) => !e.data.draft);
}
