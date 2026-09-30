import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { SITE } from '../site';
import { getPosts, postUrl } from '../utils';

export async function GET(context: APIContext) {
  const posts = await getPosts();
  return rss({
    title: `${SITE.name} — Writing`,
    description: SITE.description,
    site: context.site!,
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.date,
      link: postUrl(post),
      description: post.data.description,
      categories: [...post.data.categories, ...post.data.tags],
      // Rendered HTML body, like the old Jekyll feed
      content: post.rendered?.html,
    })),
  });
}
