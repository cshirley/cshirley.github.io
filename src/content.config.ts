import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const posts = defineCollection({
  // Keep the original Jekyll file names (YYYY-MM-DD-slug) as entry ids.
  loader: glob({
    pattern: '*.md',
    base: './src/content/posts',
    generateId: ({ entry }) => entry.replace(/\.md$/, ''),
  }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    date: z.coerce.date(),
    /** Drafts render in `npm run dev` but are excluded from production builds. */
    draft: z.boolean().default(false),
    published: z.boolean().default(true),
    categories: z.array(z.string()).default([]),
    tags: z.array(z.string()).nullish().transform((t) => t ?? []),
    author: z.object({ display_name: z.string(), email: z.string().optional() }).optional(),
  }),
});

export const collections = { posts };
