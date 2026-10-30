// Confirm an article is genuinely served by the live site before anything is sent elsewhere.
const TIMEOUT_MS = 15_000;

const norm = (u) => {
  const url = new URL(u);
  return `${url.origin}${url.pathname}`;
};

const canonicalOf = (html) =>
  html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] ??
  html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i)?.[1];

/** Resolves { ok: true, html } or { ok: false, reason }. Never throws for site problems. */
export async function checkLive(article, { fetch = globalThis.fetch, timeoutMs = TIMEOUT_MS } = {}) {
  try {
    const res = await fetch(article.url, { headers: { 'cache-control': 'no-cache' }, signal: AbortSignal.timeout(timeoutMs) });
    if (res.status !== 200) return { ok: false, reason: `HTTP ${res.status}` };
    const type = res.headers.get('content-type') ?? '';
    if (!/text\/html/i.test(type)) return { ok: false, reason: `unexpected content-type "${type}"` };
    if (res.url && norm(res.url) !== norm(article.url)) return { ok: false, reason: `redirected to ${res.url}` };
    const html = await res.text();
    const canonical = canonicalOf(html);
    if (!canonical) return { ok: false, reason: 'no canonical link' };
    if (norm(canonical) !== norm(article.url)) return { ok: false, reason: `canonical is ${canonical}` };
    return { ok: true, html };
  } catch (err) {
    return { ok: false, reason: err.cause?.code ?? err.message };
  }
}
