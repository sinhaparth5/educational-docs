import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

// Sveltia CMS writes empty optional fields as `null` or `''`; treat those as not set.
const unset = <T extends z.ZodType>(schema: T) =>
	z.preprocess((v) => (v === null || v === '' ? undefined : v), schema);

const posts = defineCollection({
	loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			date: z.coerce.date(),
			updated: unset(z.coerce.date().optional()),
			featured: z.boolean().default(false),
			tags: z.array(z.string()).default([]),
			draft: z.boolean().default(false),
			// Optional 1200×630 image, relative to the post file. Used as the post's social
			// preview and shown on the home page; posts without one get a generated card.
			cover: unset(image().optional()),
			coverAlt: z.string().default(''),
			// Multi-part posts: same name, part = 1, 2, 3…
			series: unset(z.object({ name: z.string(), part: z.number().int().positive() }).optional()),
		}),
});

export const collections = { posts };
