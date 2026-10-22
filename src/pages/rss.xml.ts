import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { loadRenderers } from 'astro:container';
import { render } from 'astro:content';
import { getContainerRenderer } from '@astrojs/mdx/container-renderer';
import Theorem from '@/components/math/theorem/Theorem.astro';
import Proof from '@/components/math/proof/Proof.astro';
import Note from '@/components/math/note/Note.astro';
import Sidenote from '@/components/math/sidenote/Sidenote.astro';
import DocCard from '@/components/posts/doc-card/DocCard.astro';
import { SITE, getPosts } from '@/lib/site';

export const GET: APIRoute = async (context) => {
	// Full post HTML, so feed readers don't have to open the site. Same components as [...id].astro.
	const container = await AstroContainer.create({
		renderers: await loadRenderers([getContainerRenderer()]),
	});
	const components = { Theorem, Proof, Note, Sidenote, DocCard };
	// Feed readers don't know the page URL, so make /root links and images absolute
	const absolute = (html: string) =>
		html.replace(/(href|src)="\/(?!\/)/g, `$1="${new URL('/', context.site)}`);

	return rss({
		title: SITE.title,
		description: SITE.description,
		site: context.site!,
		items: await Promise.all(
			(await getPosts()).map(async (post) => {
				const { Content } = await render(post);
				return {
					title: post.data.title,
					description: post.data.description,
					content: absolute(await container.renderToString(Content, { props: { components } })),
					pubDate: post.data.date,
					categories: post.data.tags,
					link: `/posts/${post.id}/`,
				};
			}),
		),
	});
};
