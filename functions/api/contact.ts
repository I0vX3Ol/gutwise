/**
 * Cloudflare Pages Function — contact form handler.
 *
 * Security posture, in the order checks run:
 *   1. Method and content-type are pinned; anything else is rejected outright.
 *   2. Payload size is capped before parsing, so a huge body cannot be used to
 *      burn CPU time.
 *   3. Fields are *whitelisted*, not merely validated — any field not named in
 *      ALLOWED_FIELDS is dropped rather than forwarded. This blocks parameter
 *      tampering, where an attacker appends extra keys hoping something
 *      downstream trusts them.
 *   4. The honeypot is checked before anything expensive happens.
 *   5. Cloudflare Turnstile is verified server-side. A client-side token is
 *      meaningless on its own; only the siteverify response counts.
 *   6. Every value is length-bounded and the message is escaped before it is
 *      placed into the forwarded HTML body.
 *
 * No database, no session, no cookies — so there is no SQL to parameterise, no
 * session cookie to harden and no stored data to encrypt. That is a deliberate
 * architectural choice rather than an omission.
 *
 * Secrets (TURNSTILE_SECRET_KEY, CONTACT_FORWARD_ENDPOINT) come from the
 * Cloudflare Pages environment and are never present in client code.
 */

import {
	EMAIL_RE,
	MAX_BODY_BYTES,
	errorPage,
	escapeHtml,
	isFormPost,
	redirect,
	sanitize,
	verifyTurnstile,
} from '../../shared/form-utils';

interface Env {
	TURNSTILE_SECRET_KEY?: string;
	CONTACT_FORWARD_ENDPOINT?: string;
}

/** Only these fields are ever read from the submission. */
const ALLOWED_FIELDS = ['name', 'email', 'topic', 'message'] as const;

/** Values outside this set are coerced to 'other' rather than trusted. */
const ALLOWED_TOPICS = new Set([
	'question',
	'correction',
	'story',
	'partnership',
	'other',
]);

const LIMITS = { name: 100, email: 200, message: 5000 } as const;

const BACK = '/contact/';

export const onRequestPost: PagesFunction<Env> = async (context) => {
	const { request, env } = context;
	const origin = new URL(request.url).origin;

	// --- 1. Method and content type -----------------------------------------
	if (!isFormPost(request)) {
		return errorPage('That submission was not in a format we recognise.', 415, BACK);
	}

	// --- 2. Size cap before parsing -----------------------------------------
	if (Number(request.headers.get('content-length') ?? '0') > MAX_BODY_BYTES) {
		return errorPage(
			'That message was too large to send. Please shorten it and try again.',
			413,
			BACK,
		);
	}

	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		return errorPage('We could not read that submission.', 400, BACK);
	}

	// --- 3. Honeypot ---------------------------------------------------------
	// The field is hidden from humans and assistive technology alike, so any
	// value in it means an automated submission.
	const honeypot = form.get('website');
	if (typeof honeypot === 'string' && honeypot.trim() !== '') {
		// Return the success redirect so bots learn nothing from the response.
		return redirect('/thank-you/', origin);
	}

	// --- 4. Whitelist and normalise -----------------------------------------
	const fields: Record<string, string> = {};
	for (const key of ALLOWED_FIELDS) {
		const raw = form.get(key);
		fields[key] = typeof raw === 'string' ? sanitize(raw) : '';
	}

	if (!fields.name || fields.name.length > LIMITS.name) {
		return errorPage('Please tell us your name, then try again.', 400, BACK);
	}
	if (
		!fields.email ||
		fields.email.length > LIMITS.email ||
		!EMAIL_RE.test(fields.email)
	) {
		return errorPage(
			'That email address does not look complete — please check it and try again.',
			400,
			BACK,
		);
	}
	if (!fields.message || fields.message.length > LIMITS.message) {
		return errorPage('Please write your message, then try again.', 400, BACK);
	}

	// Unknown topics are normalised rather than rejected — a tampered select
	// should not be able to inject an arbitrary string downstream.
	const topic = ALLOWED_TOPICS.has(fields.topic) ? fields.topic : 'other';

	// --- 5. Turnstile --------------------------------------------------------
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

	// --- 6. Forward ----------------------------------------------------------
	if (!env.CONTACT_FORWARD_ENDPOINT) {
		// Misconfiguration should be loud in logs but vague to the visitor.
		console.error('CONTACT_FORWARD_ENDPOINT is not configured.');
		return errorPage(
			'Our contact form is not configured yet. Please email us directly.',
			500,
			BACK,
		);
	}

	// Only the fields we validated are forwarded — nothing is passed through
	// from the original request.
	const payload = {
		name: fields.name,
		email: fields.email,
		topic,
		message: fields.message,
		html: `<p><strong>From:</strong> ${escapeHtml(fields.name)} &lt;${escapeHtml(fields.email)}&gt;</p>
<p><strong>Topic:</strong> ${escapeHtml(topic)}</p>
<hr>
<p>${escapeHtml(fields.message).replace(/\n/g, '<br>')}</p>`,
		submittedAt: new Date().toISOString(),
		country: request.headers.get('cf-ipcountry') ?? 'unknown',
	};

	try {
		const res = await fetch(env.CONTACT_FORWARD_ENDPOINT, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json',
			},
			body: JSON.stringify(payload),
		});

		if (!res.ok) {
			console.error(`Forwarding failed with status ${res.status}`);
			return errorPage(
				'We could not send your message just now. Please email us directly.',
				502,
				BACK,
			);
		}
	} catch (error) {
		console.error('Forwarding threw:', error);
		return errorPage(
			'We could not send your message just now. Please email us directly.',
			502,
			BACK,
		);
	}

	// POST/redirect/GET so a refresh cannot resubmit, and so the conversion
	// lands on the tracked /thank-you/ page.
	return redirect('/thank-you/', origin);
};

/**
 * Anything other than POST is rejected explicitly.
 *
 * These are declared as method-specific handlers rather than as a catch-all
 * `onRequest`: Pages gives a catch-all precedence over `onRequestPost`, and
 * `context.next()` inside it would fall through to the static asset server
 * rather than to the handler above — silently breaking the form.
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
