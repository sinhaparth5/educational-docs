// Post preview with KaTeX, matching remark-math: $inline$ and $$display$$.
// Math is swapped for placeholders before marked runs (so _ and * inside TeX aren't
// read as emphasis), the HTML is sanitized, then KaTeX output is put back.
// ponytail: MDX components and [@cite] keys still show as raw text; use `astro dev` for those.
const MATH = /(```[\s\S]*?```|`[^`\n]*`)|(?<!\\)\$\$([\s\S]+?)\$\$|(?<!\\)\$([^\s$](?:[^$\n]*?[^\s$\\])?)\$/g;

function render(markdown) {
	const math = [];
	const text = markdown.replace(MATH, (all, code, block, inline) => {
		if (code) return all;
		math.push([block ?? inline, block !== undefined]);
		const token = `KATEXPLACEHOLDER${math.length - 1}X`;
		return block !== undefined ? `\n\n${token}\n\n` : token;
	});
	const html = DOMPurify.sanitize(marked.parse(text));
	return html.replace(/(<p>)?KATEXPLACEHOLDER(\d+)X(<\/p>)?/g, (all, open, i, close) => {
		const [tex, displayMode] = math[i];
		const out = katex.renderToString(tex, { displayMode, throwOnError: false });
		return displayMode ? out : (open ?? '') + out + (close ?? '');
	});
}

CMS.registerPreviewStyle('https://unpkg.com/katex@0.19.1/dist/katex.min.css');
CMS.registerPreviewStyle(
	'body { font-family: system-ui, sans-serif; line-height: 1.6; max-width: 46rem; margin: 0 auto; padding: 1rem; } .katex-display { overflow-x: auto; overflow-y: hidden; } img { max-width: 100%; }',
	{ raw: true },
);

CMS.registerPreviewTemplate('posts', ({ entry }) =>
	h('article', {}, [
		h('h1', { key: 'title' }, entry.getIn(['data', 'title']) ?? ''),
		h('div', {
			key: 'body',
			dangerouslySetInnerHTML: { __html: render(entry.getIn(['data', 'body']) ?? '') },
		}),
	]),
);
