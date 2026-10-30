#!/usr/bin/env node
/**
 * Release gate: a post that is not a draft must be approved (its content unchanged since
 * `npm run post:approve`) or grandfathered in src/data/approval-baseline.json. This stops
 * hand-editing `draft: false` from bypassing review. It is fatal on every build, including the
 * daily scheduled rebuild. A stale approval on any post is also an error, since it means the
 * reviewed content has changed.
 *
 *   npm run check:approval
 */
import { annotate } from './lib/dist.mjs';
import { loadPosts } from './lib/posts.mjs';

const posts = await loadPosts();
const problems = [];
for (const p of posts) {
  if (!p.published) continue;
  if (!p.draft && !p.approvalOk) {
    problems.push(`${p.id}: not a draft but ${p.approvalStatus === 'stale' ? 'edited since approval' : 'not approved'}. Run: npm run post:approve -- ${p.id}`);
  } else if (p.approvalStatus === 'stale' && !p.draft) {
    problems.push(`${p.id}: edited since approval`);
  }
}
if (problems.length) {
  for (const msg of problems) annotate('error', msg);
  process.exit(1);
}
console.log(`Approval: ${posts.length} posts checked.`);
