import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const posts = defineCollection({
	loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		date: z.coerce.date(),
		updated: z.coerce.date().optional(),
		featured: z.boolean().default(false),
		tags: z.array(z.string()).default([]),
		draft: z.boolean().default(false),
		// Multi-part posts: same name, part = 1, 2, 3…
		series: z.object({ name: z.string(), part: z.number().int().positive() }).optional(),
	}),
});

export const collections = { posts };
