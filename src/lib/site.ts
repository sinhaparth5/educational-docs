import { getCollection } from 'astro:content';

export const SITE = {
	title: 'Parth Sinha',
	description: 'Interactive notes on math and computing.',
	homePosts: 5,
};

export const formatDate = (date: Date) =>
	date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

// Published posts, newest first
export const getPosts = async () =>
	(await getCollection('posts', (p) => !p.data.draft)).sort(
		(a, b) => b.data.date.valueOf() - a.data.date.valueOf(),
	);
