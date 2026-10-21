import { getCollection, type CollectionEntry } from 'astro:content';

export const SITE = {
	title: 'Parth Sinha',
	author: 'Parth Sinha',
	description: 'Interactive notes on math and computing.',
	recentPosts: 4,
	// Links shown on the home page; leave one empty to hide it
	socials: {
		email: 'parth@devflowfix.com',
		website: 'https://parthsinha.com',
		linkedin: 'https://www.linkedin.com/in/parth-sinha18',
		x: 'https://x.com/parth_sinha18',
		github: 'https://github.com/sinhaparth5',
	},
	// Comments via GitHub Discussions. IDs come from https://giscus.app after setup;
	// the comment box stays hidden while repoId is empty.
	giscus: {
		repo: 'sinhaparth5/educational-docs',
		repoId: 'R_kgDOVQqLaQ',
		category: 'Announcements', // only maintainers + giscus can open threads here
		categoryId: 'DIC_kwDOVQqLac4DJJ-y',
	},
	// Self-hosted Umami (https://umami.is). Disabled while websiteId is empty.
	analytics: {
		src: '', // e.g. 'https://stats.parthsinha.com/script.js'
		websiteId: '',
	},
	// Google Analytics + Tag Manager, held at consent "denied" until the cookie banner is accepted
	google: {
		gaId: 'G-3VKGFDNT00',
		gtmId: 'GTM-P2F5PKZJ',
	},
};

export type Post = CollectionEntry<'posts'>;

export const formatDate = (date: Date) =>
	date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** Posts newest first. Drafts are included under `astro dev` only, never in a build. */
export const getPosts = async () =>
	(await getCollection('posts', (p) => import.meta.env.DEV || !p.data.draft)).sort(
		(a, b) => b.data.date.valueOf() - a.data.date.valueOf(),
	);

// ponytail: counts words in the raw MDX (imports, JSX and LaTeX included), so it reads a bit high
export const readingTime = (post: Post) => {
	const words = post.body?.split(/\s+/).filter(Boolean).length ?? 0;
	return Math.max(1, Math.round(words / 220));
};

/** Up to `limit` other posts, ranked by how many tags they share with `post`. */
export const relatedPosts = (post: Post, posts: Post[], limit = 3) =>
	posts
		.filter((p) => p.id !== post.id)
		.map((p) => ({ p, shared: p.data.tags.filter((t) => post.data.tags.includes(t)).length }))
		.filter(({ shared }) => shared > 0)
		.sort((a, b) => b.shared - a.shared)
		.slice(0, limit)
		.map(({ p }) => p);

/** Other parts of the series `post` belongs to, ordered by part number. */
export const seriesParts = (post: Post, posts: Post[]) =>
	post.data.series
		? posts
				.filter((p) => p.data.series?.name === post.data.series!.name)
				.sort((a, b) => a.data.series!.part - b.data.series!.part)
		: [];
