import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { SITE, getPosts } from '@/lib/site';

export const GET: APIRoute = async (context) =>
	rss({
		title: SITE.title,
		description: SITE.description,
		site: context.site!,
		items: (await getPosts()).map((post) => ({
			title: post.data.title,
			description: post.data.description,
			pubDate: post.data.date,
			categories: post.data.tags,
			link: `/posts/${post.id}/`,
		})),
	});
