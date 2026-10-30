// Medium: one story per article, created from the local Medium-friendly export with the site's
// canonical URL. Medium decides the final status, so the returned status is what gets recorded.
import { spawnSync } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PublishError } from '../runner.mjs';

const API = 'https://api.medium.com/v1';
const toolRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.tif': 'image/tiff', '.tiff': 'image/tiff' };
const decode = (s) => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** Default export: render the article from the source snapshot with scripts/medium-export.mjs. */
export function exportWithBrowser(article, { sourceRoot, outDir }) {
  const run = spawnSync(process.execPath, [path.join(toolRoot, 'scripts/medium-export.mjs'), '--source-root', sourceRoot, '--out', outDir, article.id], { cwd: toolRoot, stdio: ['ignore', 'ignore', 'inherit'] });
  if (run.status !== 0) throw new Error(`medium export failed for ${article.id}`);
}

class Http extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function call(ctx, method, route, { json, form } = {}) {
  const headers = { Authorization: `Bearer ${ctx.env.MEDIUM_TOKEN}`, Accept: 'application/json', ...(json ? { 'Content-Type': 'application/json' } : {}) };
  const res = await ctx.fetch(`${API}${route}`, { method, headers, body: json ? JSON.stringify(json) : form, signal: AbortSignal.timeout(60_000) });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Http(res.status, `Medium ${method} ${route} -> HTTP ${res.status} ${JSON.stringify(out.errors ?? out).slice(0, 300)}`);
  return { status: res.status, data: out.data };
}

export const medium = {
  name: 'medium',
  /** Bounded batch per run; no daily cap initially. */
  policy: { perRunLimit: 3, dailyAllowance: null, blockOnReview: false },
  missingConfig: (env) => ['MEDIUM_TOKEN'].filter((k) => !env[k]),

  async prepare(article, ctx) {
    const outDir = path.join(ctx.workDir, 'medium', ctx.sourceSha ?? 'local');
    await mkdir(outDir, { recursive: true });
    await (ctx.exportArticle ?? exportWithBrowser)(article, { sourceRoot: ctx.sourceRoot, outDir });
    const dir = path.join(outDir, article.id);
    const file = path.join(dir, 'index.html');
    if (!existsSync(file)) throw new Error('export produced no index.html');
    const html = await readFile(file, 'utf8');
    const content = html.match(/<article>([\s\S]*?)<\/article>/)?.[1].trim();
    if (!content) throw new Error('no <article> in export');
    const canonicalUrl = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
    if (canonicalUrl !== article.url) throw new Error(`export canonical ${canonicalUrl} does not match ${article.url}`);
    const tags = decode(html.match(/<meta name="medium-tags" content="([^"]*)"/)?.[1] ?? '').split(',').map((t) => t.trim()).filter(Boolean).slice(0, 5);
    const images = [...new Set([...content.matchAll(/<img [^>]*src="(images\/[^"]+)"/g)].map((m) => m[1]))];
    const publishStatus = ctx.options?.mediumDraft ? 'draft' : 'public';
    return { title: decode(html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? article.title), content, canonicalUrl, tags, images, dir, publishStatus, notifyFollowers: publishStatus === 'public' && !/^(0|false|no|off)$/i.test(ctx.env.MEDIUM_NOTIFY_FOLLOWERS ?? ''), publication: ctx.env.MEDIUM_PUBLICATION || null };
  },

  async publish(prepared, ctx) {
    let route;
    let content = prepared.content;
    let publication;
    try {
      const userId = (await call(ctx, 'GET', '/me')).data.id;
      if (prepared.publication) {
        const q = prepared.publication.toLowerCase();
        const pubs = (await call(ctx, 'GET', `/users/${userId}/publications`)).data;
        publication = pubs.find((x) => x.id === prepared.publication || x.url.toLowerCase().endsWith(`/${q}`) || x.name.toLowerCase() === q);
        if (!publication) throw new Error(`publication "${prepared.publication}" not found`);
      }
      for (const src of prepared.images) {
        const type = MIME[path.extname(src).toLowerCase()];
        if (!type) throw new Error(`Medium cannot take ${path.extname(src)} images: ${src}`);
        const form = new FormData();
        form.append('image', new Blob([await readFile(path.join(prepared.dir, src))], { type }), path.basename(src));
        content = content.split(`"${src}"`).join(`"${(await call(ctx, 'POST', '/images', { form })).data.url}"`);
      }
      route = publication ? `/publications/${publication.id}/posts` : `/users/${userId}/posts`;
    } catch (err) {
      // Nothing has been submitted as a story yet, so a failure here created no article.
      throw new PublishError('not-created', `before story creation: ${err.message}`);
    }
    let post;
    try {
      post = (await call(ctx, 'POST', route, { json: { title: prepared.title, contentFormat: 'html', content, canonicalUrl: prepared.canonicalUrl, tags: prepared.tags, publishStatus: prepared.publishStatus, notifyFollowers: prepared.notifyFollowers } })).data;
    } catch (err) {
      if (err instanceof Http && err.status >= 400 && err.status < 500 && err.status !== 408) throw new PublishError('not-created', err.message);
      throw new PublishError('uncertain', `Medium story request failed: ${err.message}`);
    }
    const status = { public: 'published', draft: 'draft' }[post?.publishStatus];
    if (!post?.id || !status) throw new PublishError('uncertain', `Medium returned an unexpected story: ${JSON.stringify(post)?.slice(0, 200)}`);
    return { outcome: status, externalId: post.id, url: post.url, extra: publication ? { publication: publication.name } : {} };
  },
};
