// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import { unified, rehypeHeadingIds } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeCitation from 'rehype-citation';
import * as pagefind from 'pagefind';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';

/**
 * Writes .gz and .br next to every text asset so nginx can serve them
 * with `gzip_static on;` / `brotli_static on;` and skip compressing per request.
 * @returns {import('astro').AstroIntegration}
 */
function precompress() {
	return {
		name: 'precompress',
		hooks: {
			'astro:build:done': async ({ dir, logger }) => {
				const root = fileURLToPath(dir);
				const files = (await readdir(root, { recursive: true })).filter((f) =>
					/\.(html|css|js|mjs|json|xml|svg|txt)$/.test(f),
				);
				for (const f of files) {
					const path = `${root}/${f}`;
					const data = await readFile(path);
					if (data.length < 1024) continue; // not worth it for tiny files
					await writeFile(`${path}.gz`, gzipSync(data, { level: 9 }));
					await writeFile(
						`${path}.br`,
						brotliCompressSync(data, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }),
					);
				}
				logger.info(`pre-compressed ${files.length} files`);
			},
		},
	};
}

/**
 * Builds the Pagefind search index into dist/pagefind after the site is built.
 * Only elements marked data-pagefind-body (post articles) are indexed.
 * @returns {import('astro').AstroIntegration}
 */
function search() {
	return {
		name: 'pagefind',
		hooks: {
			'astro:build:done': async ({ dir, logger }) => {
				const { index } = await pagefind.createIndex({});
				if (!index) throw new Error('pagefind: could not create index');
				const { page_count } = await index.addDirectory({ path: fileURLToPath(dir) });
				await index.writeFiles({ outputPath: fileURLToPath(new URL('pagefind', dir)) });
				await pagefind.close();
				logger.info(`indexed ${page_count} pages`);
			},
		},
	};
}

/**
 * Finishes rehype-citation's output:
 * - links each [n] to its entry (rehype-citation's own `linkCitations` crashes on
 *   locators like [@key, p. 9], so it stays off and this does the linking)
 * - makes URLs in the reference list clickable
 * - puts an h2 "References" above the list so it gets an anchor and a TOC entry
 */
function rehypeReferences() {
	/** @param {any} node @param {(n: any) => void} fn */
	const walk = (node, fn) => {
		fn(node);
		node.children?.forEach((/** @type {any} */ c) => walk(c, fn));
	};
	/** @param {string} key @param {string} text */
	const link = (key, text) => ({
		type: 'element',
		tagName: 'a',
		properties: { href: `#bib-${key}`, className: ['cite'] },
		children: [{ type: 'text', value: text }],
	});

	/** @param {any} tree */
	return (tree) => {
		walk(tree, (node) => {
			const id = node.properties?.id;
			if (node.tagName !== 'span' || typeof id !== 'string' || !id.startsWith('citation--')) return;
			// id looks like citation--key1--key2--<n>; text like "[1, p. 9]" or "[2], [3]"
			const keys = id.split('--').slice(1, -1);
			const text = node.children.map((/** @type {any} */ c) => c.value ?? '').join('');
			const groups = text.match(/\[[^\]]*\]/g) ?? [];
			if (groups.length === keys.length) {
				const parts = text.split(/(\[[^\]]*\])/);
				let k = 0;
				node.children = parts
					.filter(Boolean)
					.map((/** @type {string} */ part) => (/^\[.*\]$/.test(part) ? link(keys[k++], part) : { type: 'text', value: part }));
			} else {
				node.children = [link(keys[0], text)]; // collapsed ranges like [2]–[4]
			}
		});

		const i = tree.children.findIndex((/** @type {any} */ n) => n.properties?.id === 'refs');
		if (i === -1) return;

		walk(tree.children[i], (node) => {
			if (!node.children || node.tagName === 'a') return; // don't re-wrap links we just made
			node.children = node.children.flatMap((/** @type {any} */ c) =>
				c.type !== 'text'
					? [c]
					: c.value
							.split(/(https?:\/\/[^\s)]+)/)
							.filter(Boolean)
							.map((/** @type {string} */ part) =>
								/^https?:/.test(part)
									? { type: 'element', tagName: 'a', properties: { href: part }, children: [{ type: 'text', value: part }] }
									: { type: 'text', value: part },
							),
			);
		});

		tree.children.splice(i, 0, {
			type: 'element',
			tagName: 'h2',
			properties: {},
			children: [{ type: 'text', value: 'References' }],
		});
	};
}

// https://astro.build/config
export default defineConfig({
	site: 'https://edu.parthsinha.com',
	// Inline all CSS into each page: no render-blocking stylesheet requests on first visit,
	// which matters most since readers usually land on a single post from a shared link
	build: { inlineStylesheets: 'always' },
	integrations: [
		mdx(),
		react(),
		sitemap({
			filter: (page) => !page.includes('/drafts/'),
		}),
		search(), // before precompress so its files get compressed too
		precompress(),
	],
	// Post images get a srcset and WebP output at build time; never wider than the column
	image: { layout: 'constrained' },
	markdown: {
		processor: unified({
			remarkPlugins: [remarkMath],
			rehypePlugins: [
				rehypeKatex,
				// [@key] → IEEE-style [1] linked to a numbered list at the end of the post
				[
					rehypeCitation,
					{
						bibliography: 'src/content/references/references.bib',
						csl: 'src/content/references/ieee.csl',
					},
				],
				rehypeReferences,
				rehypeHeadingIds, // ids must exist before autolink runs
				[
					rehypeAutolinkHeadings,
					{
						behavior: 'append',
						properties: {
							className: ['anchor'],
							ariaLabel: 'Link to this section',
							dataPagefindIgnore: 'all', // keep the '#' out of search results
						},
						content: { type: 'text', value: '#' },
					},
				],
			],
		}),
		shikiConfig: {
			// Both chosen because every common token passes WCAG AA on our --code-bg colors
			themes: { light: 'github-light-high-contrast', dark: 'everforest-dark' },
		},
	},
	vite: {
		build: {
			// Big chunks are viz libs inside client:visible islands, loaded only on scroll
			chunkSizeWarningLimit: 1500,
			rollupOptions: {
				onwarn(warning, warn) {
					// jsxgraph's own eval, can't fix from here
					if (warning.code === 'EVAL' && warning.id?.includes('jsxgraph')) return;
					warn(warning);
				},
				output: {
					// Keep heavy viz libs out of the shared bundle
					manualChunks(id) {
						if (id.includes('node_modules/three')) return 'three-vendor';
					},
				},
			},
		},
	},
});
