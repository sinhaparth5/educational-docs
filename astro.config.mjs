// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
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

// https://astro.build/config
export default defineConfig({
	site: 'https://edu.parthsinha.com',
	integrations: [
		mdx(),
		react(),
		sitemap({
			filter: (page) => !page.includes('/drafts/'),
		}),
		precompress(),
	],
	markdown: {
		processor: unified({
			remarkPlugins: [remarkMath],
			rehypePlugins: [rehypeKatex],
		}),
		shikiConfig: {
			themes: { light: 'github-light', dark: 'github-dark-dimmed' },
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
