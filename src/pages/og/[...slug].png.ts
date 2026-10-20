import type { APIRoute, GetStaticPaths } from 'astro';
import { readFile } from 'node:fs/promises';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

// One card per MDX page, built from its frontmatter title
const pages = import.meta.glob<{ frontmatter: { title?: string } }>('../**/*.mdx', { eager: true });

export const getStaticPaths = (() =>
	Object.entries(pages).map(([path, mod]) => ({
		params: { slug: path.replace(/^\.\.\//, '').replace(/\.mdx$/, '') },
		props: { title: mod.frontmatter.title ?? 'Educational Docs' },
	}))) satisfies GetStaticPaths;

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
					alignItems: 'center',
					padding: '80px',
					background: '#22272e',
					color: '#adbac7',
					fontSize: 72,
				},
				children: props.title,
			},
		},
		{ width: 1200, height: 630, fonts: [{ name: 'Main', data: font }] },
	);
	const png = new Resvg(svg).render().asPng();
	return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
