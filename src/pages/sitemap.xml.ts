import type { APIContext } from 'astro';
import { getPosts, postUrl } from '../utils';

const STATIC_PAGES = ['/', '/about/', '/blog/', '/lessons/', '/contact/', '/privacy/'];

export async function GET({ site }: APIContext) {
  const posts = await getPosts();
  // Index pages change whenever the newest post changes. Posts are sorted newest first.
  const newest = posts[0] && (posts[0].data.updated ?? posts[0].data.date);
  const urls: { path: string; lastmod?: Date }[] = [
    ...STATIC_PAGES.map((path) => ({ path, lastmod: path === '/' || path === '/blog/' ? newest : undefined })),
    ...posts.map((p) => ({ path: postUrl(p), lastmod: p.data.updated ?? p.data.date })),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(({ path, lastmod }) =>
    `  <url><loc>${new URL(path, site).href}</loc>${lastmod ? `<lastmod>${lastmod.toISOString()}</lastmod>` : ''}</url>`)
  .join('\n')}
</urlset>
`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml' } });
}
