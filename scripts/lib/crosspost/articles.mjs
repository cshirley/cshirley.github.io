// Articles eligible for cross-posting, read from an explicit source snapshot (never the process
// working directory) using the same approval and date rules as the site and the authoring CLI.
import { loadPosts } from '../posts.mjs';

/**
 * sourceRoot: checkout of the deployed commit. eligibleAt: when that build was made. An article
 * that became due after the build was not part of the deployed site, so it is excluded.
 */
export async function loadArticles({ sourceRoot, eligibleAt = new Date() }) {
  const at = new Date(eligibleAt).valueOf();
  if (Number.isNaN(at)) throw new Error(`invalid eligibility time: ${eligibleAt}`);
  const posts = await loadPosts(at, { sourceRoot });
  return posts
    .filter((p) => p.published && !p.draft && p.date.valueOf() <= at && p.approvalOk)
    .map((p) => ({ id: p.id, slug: p.slug, title: p.title, description: p.description, date: p.date, url: p.url, urlPath: p.urlPath, categories: p.categories, tags: p.tags, sourceRoot }))
    .sort((a, b) => a.date - b.date || a.id.localeCompare(b.id));
}
