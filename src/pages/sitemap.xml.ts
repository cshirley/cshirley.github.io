import type { APIContext } from 'astro';
import { getPosts, postUrl } from '../utils';

const STATIC_PAGES = ['/', '/about/', '/blog/', '/contact/'];

export async function GET({ site }: APIContext) {
  const posts = await getPosts();
  const urls: { path: string; lastmod?: Date }[] = [
    ...STATIC_PAGES.map((path) => ({ path })),
    ...posts.map((p) => ({ path: postUrl(p), lastmod: p.data.date })),
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
