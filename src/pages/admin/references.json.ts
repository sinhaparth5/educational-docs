import type { APIRoute } from 'astro';
import { readFileSync } from 'node:fs';

// The bibliography as { key: "formatted reference" } for the CMS preview's [@key] citations.
// ponytail: a light IEEE-ish formatter for previews only; the site itself renders references
// with rehype-citation + ieee.csl. Handles one level of nested braces, which is all the .bib uses.
const bib = readFileSync('src/content/references/references.bib', 'utf8');
const strip = (s: string) => s.replace(/[{}]/g, '').replace(/--/g, '–').trim();

function authors(list: string) {
	return list
		.split(/\s+and\s+/)
		.map((a) => {
			if (a.startsWith('{')) return strip(a); // {Organisation Name}
			const [last, first = ''] = a.split(',').map((s) => s.trim());
			const initials = first.split(/\s+/).filter(Boolean).map((n) => `${n[0]}.`).join(' ');
			return [initials, strip(last)].filter(Boolean).join(' ');
		})
		.join(', ');
}

const refs: Record<string, string> = {};
for (const [, type, key, body] of bib.matchAll(/@(\w+)\s*\{\s*([^,\s]+)\s*,([\s\S]*?)\n\}/g)) {
	const f: Record<string, string> = {};
	for (const [, name, value] of body.matchAll(/(\w+)\s*=\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g)) {
		f[name.toLowerCase()] = value;
	}
	const book = type.toLowerCase() === 'book';
	refs[key] = [
		f.author && `${authors(f.author)},`,
		f.title && (book ? `${strip(f.title)},` : `“${strip(f.title)},”`),
		f.journal && `${strip(f.journal)},`,
		f.edition && `${strip(f.edition)} ed.,`,
		f.publisher && `${[f.address, f.publisher].filter(Boolean).map(strip).join(': ')},`,
		f.volume && `vol. ${strip(f.volume)},`,
		f.pages && `pp. ${strip(f.pages)},`,
		f.year && `${strip(f.year)}.`,
		f.url && strip(f.url),
	]
		.filter(Boolean)
		.join(' ')
		.replace(/,$/, '.');
}

export const GET: APIRoute = () =>
	new Response(JSON.stringify(refs), { headers: { 'Content-Type': 'application/json' } });
