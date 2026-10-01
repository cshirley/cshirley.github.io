import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import {
  CATEGORIES,
  DESCRIPTION_MAX,
  DESCRIPTION_MIN,
  DESCRIPTION_REQUIRED_FROM,
  TAGS,
} from './data/taxonomy';

const tagSet = new Set<string>(TAGS);
const tagByLower = new Map(TAGS.map((t) => [t.toLowerCase(), t]));

const tag = z.string().superRefine((t, ctx) => {
  if (tagSet.has(t)) return;
  const match = tagByLower.get(t.toLowerCase());
  ctx.addIssue({
    code: 'custom',
    message: match
      ? `Tag "${t}" should be written "${match}"`
      : `Unknown tag "${t}". Reuse an existing tag or add it to src/data/taxonomy.ts`,
  });
});

const posts = defineCollection({
  // Keep the original Jekyll file names (YYYY-MM-DD-slug) as entry ids.
  loader: glob({
    pattern: '*.md',
    base: './src/content/posts',
    generateId: ({ entry }) => entry.replace(/\.md$/, ''),
  }),
  schema: z
    .object({
      title: z.string().min(1),
      description: z
        .string()
        .trim()
        .min(DESCRIPTION_MIN, `description should be at least ${DESCRIPTION_MIN} characters`)
        .max(DESCRIPTION_MAX, `description should be at most ${DESCRIPTION_MAX} characters`)
        .optional(),
      date: z.coerce.date(),
      /** Drafts render in `npm run dev` but are excluded from production builds. */
      draft: z.boolean().default(false),
      published: z.boolean().default(true),
      /** Categories form the post URL; see src/data/taxonomy.ts. */
      categories: z.array(z.enum(CATEGORIES)).min(1, 'at least one category is required'),
      tags: z.array(tag).nullish().transform((t) => t ?? []),
      author: z.object({ display_name: z.string(), email: z.string().optional() }).optional(),
    })
    .superRefine((post, ctx) => {
      if (!post.description && post.date >= DESCRIPTION_REQUIRED_FROM) {
        ctx.addIssue({
          code: 'custom',
          path: ['description'],
          message: 'description is required (used in listings, RSS and the post lead)',
        });
      }
    }),
});

export const collections = { posts };
