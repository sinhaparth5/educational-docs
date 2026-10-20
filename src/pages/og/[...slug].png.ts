import type { APIRoute, GetStaticPaths } from 'astro';
import { readFile } from 'node:fs/promises';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { SITE, getPosts } from '@/lib/site';

// og/index.png for the site, og/posts/<id>.png per post
export const getStaticPaths = (async () => [
	{ params: { slug: 'index' }, props: { title: SITE.title } },
	...(await getPosts()).map((post) => ({
		params: { slug: `posts/${post.id}` },
		props: { title: post.data.title },
	})),
]) satisfies GetStaticPaths;

// KaTeX ships TTFs; satori can't read woff2, so reuse this one
const font = await readFile('node_modules/katex/dist/fonts/KaTeX_Main-Regular.ttf');

export const GET: APIRoute = async ({ props }) => {
	const svg = await satori(
		{
			type: 'div',
			props: {
				style: {
					width: '100%',
					height: '100%',
					display: 'flex',
					flexDirection: 'column',
					justifyContent: 'space-between',
					padding: '80px',
					background: '#171717',
					color: '#fff',
				},
				children: [
					{ type: 'div', props: { style: { fontSize: 72 }, children: props.title } },
					{ type: 'div', props: { style: { fontSize: 32, color: '#ff6b01' }, children: SITE.title } },
				],
			},
		},
		{ width: 1200, height: 630, fonts: [{ name: 'Main', data: font }] },
	);
	const png = new Resvg(svg).render().asPng();
	return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
