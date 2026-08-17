/**
 * Shared helpers for the Cloudflare Pages Functions that back the two forms.
 *
 * Lives outside functions/ so it is never itself routed as an endpoint — every
 * file under functions/ becomes a URL, and a stray shared module sitting there
 * would be publicly reachable.
 */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Hard cap on a raw request body, checked before parsing. */
export const MAX_BODY_BYTES = 64 * 1024;

/** Escapes text before it is interpolated into any HTML we emit or forward. */
export function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/**
 * Strips control characters that could forge headers in a downstream mailer,
 * while preserving the newlines and tabs that belong in a message body.
 */
export function sanitize(value: string): string {
	// eslint-disable-next-line no-control-regex
	return value.replace(/[^\P{Cc}\n\t]/gu, '').trim();
}

/** POST/redirect/GET so a refresh cannot resubmit the form. */
export function redirect(path: string, origin: string): Response {
	return Response.redirect(new URL(path, origin).href, 303);
}

/**
 * Verifies a Turnstile token against Cloudflare's siteverify endpoint.
 *
 * Fails **closed**: if the verification call itself errors or times out we
 * reject the submission rather than waving it through, because an attacker who
 * can disrupt the call should not thereby disable the bot check.
 */
export async function verifyTurnstile(
	token: string,
	secret: string,
	ip: string | null,
): Promise<boolean> {
	const body = new FormData();
	body.append('secret', secret);
	body.append('response', token);
	if (ip) body.append('remoteip', ip);

	try {
		const res = await fetch(
			'https://challenges.cloudflare.com/turnstile/v0/siteverify',
			{ method: 'POST', body },
		);
		if (!res.ok) return false;
		const data = (await res.json()) as { success?: boolean };
		return data.success === true;
	} catch {
		return false;
	}
}

/**
 * A form post is a browser navigation, so an error has to render as a page.
 * Returning raw JSON to someone who just pressed "Send" shows them a wall of
 * machine output with no way back.
 *
 * Kept deliberately self-contained: no external CSS, so it renders correctly
 * even under the site's strict Content-Security-Policy.
 */
export function errorPage(
	message: string,
	status: number,
	backPath: string,
): Response {
	const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Something went wrong | GutWise</title>
<style>
:root { color-scheme: light }
body {
  margin: 0; min-height: 100vh; display: grid; place-items: center;
  background: #FAF7F2; color: #241F1A; padding: 1.5rem;
  font: 400 17px/1.7 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}
main { max-width: 34rem; text-align: center }
h1 { color: #2F4A3C; font-size: 1.75rem; line-height: 1.2; margin: 0 0 .75rem }
p { color: #514A42; margin: 0 0 1rem }
a.btn {
  display: inline-block; margin-top: .75rem; padding: .75rem 1.5rem;
  border-radius: 9999px; background: #4C7361; color: #fff;
  font-weight: 600; text-decoration: none;
}
a.btn:focus-visible { outline: 3px solid #2F4A3C; outline-offset: 2px }
a.mail { color: #3C5A73 }
</style>
</head>
<body>
<main>
  <h1>Something went wrong</h1>
  <p>${escapeHtml(message)}</p>
  <p>Nothing was sent. You can go back and try again, or email us directly at
    <a class="mail" href="mailto:hello@gutwise.nexudel.com">hello@gutwise.nexudel.com</a>.</p>
  <p><a class="btn" href="${escapeHtml(backPath)}">Back to the form</a></p>
</main>
</body>
</html>`;

	return new Response(html, {
		status,
		headers: {
			'Content-Type': 'text/html; charset=utf-8',
			'Cache-Control': 'no-store',
			'X-Content-Type-Options': 'nosniff',
			'X-Robots-Tag': 'noindex',
		},
	});
}

/** Guards method and content type in one place. */
export function isFormPost(request: Request): boolean {
	const contentType = request.headers.get('content-type') ?? '';
	return (
		contentType.includes('application/x-www-form-urlencoded') ||
		contentType.includes('multipart/form-data')
	);
}
