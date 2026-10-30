// Curated entry ids, not URLs: existing post metadata remains the source of permalinks.
// cspell:ignore isnt replatforming
export const SELECTED_POST_IDS = [
  '2026-09-16-cheaper-platform-isnt-cheaper-migration',
  '2026-07-22-one-list-price-many-coupons',
  '2026-10-05-adversarial-tests-before-code',
] as const;

export const READING_COLLECTIONS = [
  {
    title: 'Changing regulated platforms',
    description: 'Retire systems, move data and rotate credentials without losing the records or the audit trail.',
    postIds: [
      '2025-04-16-decommissioning-a-telehealth-platform',
      '2026-09-02-data-residency-without-a-full-stack',
      '2026-06-24-rotating-credentials-without-downtime',
    ],
  },
  {
    title: 'Payments and commercial rules',
    description: 'Make payment timing, prices and discounts explicit contracts rather than scattered configuration.',
    postIds: [
      '2025-01-22-payment-close-to-shipment',
      '2026-07-22-one-list-price-many-coupons',
      '2026-11-11-shown-equals-charged',
    ],
  },
  {
    title: 'Engineering with agents',
    description: 'Agree the contract, challenge the tests and keep the author separate from the reviewer.',
    postIds: [
      '2026-08-19-substrate-was-the-problem',
      '2026-10-05-adversarial-tests-before-code',
      '2026-10-05-the-author-is-compromised',
    ],
  },
  {
    title: 'Platform judgement',
    description: 'Count migration effort and opportunity cost, then fix the bottleneck that matters.',
    postIds: [
      '2026-08-05-fix-dx-before-replatforming',
      '2026-10-01-medley-one-command-local-stack',
      '2026-09-16-cheaper-platform-isnt-cheaper-migration',
    ],
  },
] as const;

type PostForCuration = {
  id: string;
  data: { published: boolean; draft: boolean; date: Date };
};

/** Curation stays public-only, even when getPosts includes preview drafts or scheduled posts. */
export function selectLivePosts<T extends PostForCuration>(
  posts: readonly T[],
  ids: readonly string[],
  now = Date.now(),
): T[] {
  const live = new Map(
    posts
      .filter(({ data }) => data.published && !data.draft && data.date.valueOf() <= now)
      .map((post) => [post.id, post]),
  );
  return [...new Set(ids)].flatMap((id) => {
    const post = live.get(id);
    return post ? [post] : [];
  });
}

/** Hide the summary as well as the link when its source article is not live. */
export function selectLiveLessons<T extends PostForCuration, L extends { postId: string }>(
  posts: readonly T[],
  lessons: readonly L[],
  now = Date.now(),
): (L & { post: T })[] {
  const live = new Map(
    selectLivePosts(posts, lessons.map(({ postId }) => postId), now)
      .map((post) => [post.id, post]),
  );
  return lessons.flatMap((lesson) => {
    const post = live.get(lesson.postId);
    return post ? [{ ...lesson, post }] : [];
  });
}
