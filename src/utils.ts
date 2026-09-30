import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'posts'>;

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const pad = (n: number) => String(n).padStart(2, '0');

/** Jekyll's default post permalink, without the ".html" suffix:
 *  /:categories/:year/:month/:day/:title — kept so existing links keep working. */
export function postPath(post: Post): string {
  const d = post.data.date;
  const slug = post.id.replace(/^\d{4}-\d{2}-\d{2}-/, '');
  return [
    ...post.data.categories.map(slugify),
    d.getUTCFullYear(),
    pad(d.getUTCMonth() + 1),
    pad(d.getUTCDate()),
    slug,
  ].join('/');
}

export const postUrl = (post: Post) => `/${postPath(post)}.html`;

/** Drafts show in `npm run dev`, or in a build with SHOW_DRAFTS=1 (for previewing). */
const showDrafts = import.meta.env.DEV || import.meta.env.SHOW_DRAFTS === '1';

/** A post dated in the future is scheduled: hidden from production builds until its date.
 *  The deploy workflow rebuilds daily, so scheduled posts appear on (or just after) their date. */
export const isScheduled = (post: Post) => post.data.date.valueOf() > Date.now();

/** Published posts, newest first. */
export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection(
    'posts',
    ({ data }) =>
      data.published && (showDrafts || (!data.draft && data.date.valueOf() <= Date.now())),
  );
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export const formatDate = (d: Date, month: 'short' | 'long' = 'short') =>
  d.toLocaleDateString('en-GB', { day: 'numeric', month, year: 'numeric', timeZone: 'UTC' });

/** Plain text from a post's Markdown/HTML source. */
function plainText(post: Post): string {
  return (post.body ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#*_`>|-]+/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function readingTime(post: Post): string {
  const words = plainText(post).split(' ').length;
  return `${Math.max(1, Math.round(words / 230))} min read`;
}

/** Front-matter description, or the first ~40 words of the post. */
export function excerpt(post: Post, words = 40): string {
  if (post.data.description) return post.data.description;
  const w = plainText(post).split(' ');
  return w.slice(0, words).join(' ') + (w.length > words ? '…' : '');
}
