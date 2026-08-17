/**
 * Cloudflare Pages Function — newsletter signup.
 *
 * The form used to POST straight to the email provider, which had two problems:
 * the Turnstile widget was decorative (the provider has no idea what our token
 * means, so only a server-side siteverify actually gates anything), and the
 * provider's own confirmation page replaced /thank-you/, so the conversion
 * destination the analytics goals point at was never reached.
 *
 * This endpoint validates, verifies Turnstile, forwards to the provider and
 * then redirects to /thank-you/. It stores nothing — there is still no
 * database, and the subscriber record lives only with the email provider.
 */

import {
	EMAIL_RE,
	MAX_BODY_BYTES,
	errorPage,
	isFormPost,
	redirect,
	sanitize,
	verifyTurnstile,
} from '../../shared/form-utils';

interface Env {
	TURNSTILE_SECRET_KEY?: string;
	/** Server-side provider endpoint. Falls back to the public one. */
	NEWSLETTER_ENDPOINT?: string;
	PUBLIC_NEWSLETTER_ACTION?: string;
	/** ConvertKit/Mailchimp API key, when the provider requires one. */
	NEWSLETTER_API_KEY?: string;
}

const BACK = '/#starter-kit';

export const onRequestPost: PagesFunction<Env> = async (context) => {
	const { request, env } = context;
	const origin = new URL(request.url).origin;

	if (!isFormPost(request)) {
		return errorPage('That submission was not in a format we recognise.', 415, BACK);
	}

	if (Number(request.headers.get('content-length') ?? '0') > MAX_BODY_BYTES) {
		return errorPage('That submission was too large.', 413, BACK);
	}

	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		return errorPage('We could not read that submission.', 400, BACK);
	}

	// Honeypot — hidden from humans and assistive technology alike, so any value
	// means an automated post. Return the success redirect so bots learn nothing.
	const honeypot = form.get('website');
	if (typeof honeypot === 'string' && honeypot.trim() !== '') {
		return redirect('/thank-you/', origin);
	}

	// Whitelist: only the email address is ever read from the submission.
	const raw = form.get('email_address');
	const email = typeof raw === 'string' ? sanitize(raw) : '';

	if (!email || email.length > 200 || !EMAIL_RE.test(email)) {
		return errorPage(
			'That email address does not look complete — please check it and try again.',
			400,
			BACK,
		);
	}

	// Bot check. Only meaningful because it is verified here, server-side.
	if (env.TURNSTILE_SECRET_KEY) {
		const token = form.get('cf-turnstile-response');
		if (typeof token !== 'string' || token === '') {
			return errorPage(
				'The bot check did not complete. Please reload the page and try again.',
				400,
				BACK,
			);
		}

		const ok = await verifyTurnstile(
			token,
			env.TURNSTILE_SECRET_KEY,
			request.headers.get('cf-connecting-ip'),
		);

		if (!ok) {
			return errorPage(
				'The bot check did not pass. Please reload the page and try again.',
				403,
				BACK,
			);
		}
	}

	const endpoint = env.NEWSLETTER_ENDPOINT || env.PUBLIC_NEWSLETTER_ACTION;

	if (!endpoint) {
		console.error('Neither NEWSLETTER_ENDPOINT nor PUBLIC_NEWSLETTER_ACTION is set.');
		return errorPage(
			'Our signup form is not configured yet. Please email us and we will send the kit over.',
			500,
			BACK,
		);
	}

	// Forward only the validated address. ConvertKit accepts form-encoded posts;
	// the API key is included only when one is configured.
	const payload = new URLSearchParams({ email_address: email, email });
	if (env.NEWSLETTER_API_KEY) payload.set('api_key', env.NEWSLETTER_API_KEY);

	try {
		const res = await fetch(endpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				Accept: 'application/json',
			},
			body: payload,
			// Providers answer the POST with their own 302 to a confirmation page.
			// We do not want to follow it — our redirect to /thank-you/ is the one
			// the reader should land on.
			redirect: 'manual',
		});

		// 2xx, or an opaque/3xx provider redirect, both mean accepted.
		const accepted = res.ok || res.status === 0 || (res.status >= 300 && res.status < 400);

		if (!accepted) {
			console.error(`Newsletter provider returned ${res.status}`);
			return errorPage(
				'We could not complete your signup just now. Please try again in a moment.',
				502,
				BACK,
			);
		}
	} catch (error) {
		console.error('Newsletter forwarding threw:', error);
		return errorPage(
			'We could not reach our email provider. Please try again in a moment.',
			502,
			BACK,
		);
	}

	return redirect('/thank-you/', origin);
};

/**
 * Method-specific rejections rather than a catch-all `onRequest`: Pages gives a
 * catch-all precedence over `onRequestPost`, and `context.next()` inside it
 * falls through to the static asset server instead of the handler above.
 */
const methodNotAllowed: PagesFunction<Env> = async () =>
	new Response('Method Not Allowed', {
		status: 405,
		headers: { Allow: 'POST', 'Cache-Control': 'no-store' },
	});

export const onRequestGet = methodNotAllowed;
export const onRequestPut = methodNotAllowed;
export const onRequestPatch = methodNotAllowed;
export const onRequestDelete = methodNotAllowed;
