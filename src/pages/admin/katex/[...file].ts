import type { APIRoute, GetStaticPaths } from 'astro';
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

// Serves the installed KaTeX to the CMS at /admin/katex/, so its preview always matches
// the site's KaTeX version and needs no CDN. Only woff2 fonts: the CSS lists them first.
const dist = join(dirname(createRequire(import.meta.url).resolve('katex/package.json')), 'dist');
const fonts = readdirSync(join(dist, 'fonts')).filter((f) => f.endsWith('.woff2'));
const types: Record<string, string> = {
	js: 'text/javascript',
	css: 'text/css',
	woff2: 'font/woff2',
};

export const getStaticPaths: GetStaticPaths = () =>
	['katex.min.js', 'katex.min.css', ...fonts.map((f) => `fonts/${f}`)].map((file) => ({
		params: { file },
	}));

export const GET: APIRoute = ({ params }) =>
	new Response(readFileSync(join(dist, params.file!)), {
		headers: { 'Content-Type': types[params.file!.split('.').pop()!] },
	});
