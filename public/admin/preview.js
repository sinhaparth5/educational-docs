// CMS additions for posts: a preview that renders KaTeX, the MDX components and [@cite]
// citations, plus insert buttons for those components.
//
// Preview pipeline: code is hidden first so nothing inside it is touched. Components, math and
// interactive embeds become placeholders before marked runs (so TeX `_`/`*` and JSX survive),
// marked's output is sanitized, then the placeholders are swapped back.
// ponytail: regex-based, no MDX parser; nested components of the *same* name aren't supported.

const esc = (s = '') =>
	String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const url = (u = '') => (/^https?:\/\//i.test(u) ? esc(u) : '#');
const attrs = (s) => Object.fromEntries([...s.matchAll(/(\w+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));

const CODE = /```[\s\S]*?```|`[^`\n]*`/g;
const MATH = /(?<!\\)\$\$([\s\S]+?)\$\$|(?<!\\)\$([^\s$](?:[^$\n]*?[^\s$\\])?)\$/g;
const BLOCK = /<(Theorem|Proof|Note|DocCard)\b([^>]*)>([\s\S]*?)<\/\1>/g;
const SIDENOTE = /<Sidenote>([\s\S]*?)<\/Sidenote>/g;
const EMBED = /<([A-Z]\w*)\b[^>]*\/>/g; // viz islands like <GfMultiplier client:visible />
const CITE = /\[((?:@[\w:.-]+[^\]@;]*;?\s*)+)\]/g;

let references = {};
fetch('/admin/references.json')
	.then((r) => r.json())
	.then((r) => (references = r))
	.catch(() => {});

function component(name, a, inner) {
	if (name === 'Theorem') {
		const kind = a.kind || 'Theorem';
		return `<div class="box theorem"><p class="label">${esc(kind)}${a.title ? ` (${esc(a.title)})` : ''}.</p>${inner}</div>`;
	}
	if (name === 'Proof') return `<div class="box proof"><p class="label">Proof.</p>${inner}<p class="qed">∎</p></div>`;
	if (name === 'Note') {
		const type = a.type || 'note';
		return `<div class="box note ${esc(type)}"><p class="label">${esc(a.title || type[0].toUpperCase() + type.slice(1))}</p>${inner}</div>`;
	}
	// DocCard
	return `<div class="box doc"><p class="label">📄 ${esc(a.title)}${a.size ? ` · ${esc(a.size)}` : ''}</p>${inner}<p class="links"><a href="${url(a.href)}">PDF</a> · <a href="${url(a.source)}">Source</a></p></div>`;
}

function render(markdown) {
	const code = [];
	const stash = [];
	const cited = [];
	const put = (html, block) => {
		stash.push(html);
		return block ? `\n\nPHB${stash.length - 1}X\n\n` : `PHI${stash.length - 1}X`;
	};

	// Markdown (with code already hidden) → sanitized HTML containing placeholders
	const toHtml = (md) => {
		md = md
			.replace(/^(import|export)\s.*$/gm, '')
			.replace(BLOCK, (_, name, a, inner) => put(component(name, attrs(a), toHtml(inner.trim())), true))
			.replace(SIDENOTE, (_, inner) => {
				const html = toHtml(inner).replace(/^<p>|<\/p>\s*$/g, '');
				return put(`<sup class="sn-mark">†</sup><span class="sidenote">${html}</span>`, false);
			})
			.replace(EMBED, (_, name) => put(`<div class="box embed">Interactive: ${esc(name)} (shown on the site)</div>`, true))
			.replace(MATH, (_, block, inline) =>
				put(katex.renderToString(block ?? inline, { displayMode: block !== undefined, throwOnError: false }), block !== undefined),
			)
			.replace(CITE, (_, list) =>
				list
					.split(';')
					.map((part) => {
						const [, key, locator] = part.trim().match(/^@([\w:.-]+),?\s*(.*)$/) ?? [];
						if (!key) return '';
						if (!cited.includes(key)) cited.push(key);
						return `[${cited.indexOf(key) + 1}${locator ? `, ${locator}` : ''}]`;
					})
					.join(', '),
			)
			.replace(/CODE(\d+)X/g, (_, i) => code[i]);
		return DOMPurify.sanitize(marked.parse(md));
	};

	let html = toHtml(markdown.replace(CODE, (m) => (code.push(m), `CODE${code.length - 1}X`)));

	if (cited.length) {
		const items = cited.map((k) => `<li>${esc(references[k] ?? `Unknown reference: ${k}`)}</li>`).join('');
		html += `<h2>References</h2><ol class="refs">${items}</ol>`;
	}
	// Placeholders can nest (math inside a Theorem), so restore until none are left
	for (let prev; prev !== html; ) {
		prev = html;
		html = html
			.replace(/(?:<p>)?PHB(\d+)X(?:<\/p>)?/g, (_, i) => stash[i])
			.replace(/PHI(\d+)X/g, (_, i) => stash[i]);
	}
	return html;
}

CMS.registerPreviewStyle('/admin/katex/katex.min.css');
CMS.registerPreviewStyle(
	`body { font-family: system-ui, sans-serif; line-height: 1.6; max-width: 46rem; margin: 0 auto; padding: 1rem; color: #1f2328; }
	img { max-width: 100%; }
	pre { background: #f6f8fa; padding: .75rem; overflow-x: auto; }
	.katex-display { overflow-x: auto; overflow-y: hidden; }
	.box { border-left: 4px solid #8c959f; background: #f6f8fa; padding: .25rem 1rem; margin: 1rem 0; }
	.box .label { font-weight: 600; }
	.theorem { border-color: #0969da; } .proof { border-color: #8c959f; background: none; }
	.note.tip { border-color: #1a7f37; } .note.warning { border-color: #9a6700; }
	.doc { border-color: #cf222e; } .embed { font-style: italic; }
	.qed { text-align: right; margin: 0; }
	.sidenote { color: #59636e; font-size: .9em; } .sidenote::before { content: ' ('; } .sidenote::after { content: ')'; }`,
	{ raw: true },
);

CMS.registerPreviewTemplate('posts', ({ entry }) =>
	h('article', {}, [
		h('h1', { key: 'title' }, entry.getIn(['data', 'title']) ?? ''),
		h('div', { key: 'body', dangerouslySetInnerHTML: { __html: render(entry.getIn(['data', 'body']) ?? '') } }),
	]),
);

// Insert buttons. Attributes left at their default are omitted, like the hand-written posts.
const tag = (name, a, body) => {
	const s = Object.entries(a)
		.filter(([, v]) => v)
		.map(([k, v]) => ` ${k}="${String(v).replace(/"/g, '&quot;')}"`)
		.join('');
	return `<${name}${s}>\n\n${(body ?? '').trim()}\n\n</${name}>`;
};
const wrapped = (name) => new RegExp(`^<${name}\\b([^>]*)>\\n*([\\s\\S]*?)\\n*<\\/${name}>`, 'm');

CMS.registerEditorComponent({
	id: 'theorem',
	label: 'Theorem / Definition',
	icon: 'function',
	fields: [
		{ name: 'kind', label: 'Kind', widget: 'select', options: ['Theorem', 'Lemma', 'Corollary', 'Proposition', 'Definition'], default: 'Theorem' },
		{ name: 'title', label: 'Title', widget: 'string', required: false },
		{ name: 'body', label: 'Statement (Markdown, $math$ allowed)', widget: 'text' },
	],
	pattern: wrapped('Theorem'),
	fromBlock: (m) => ({ kind: attrs(m[1]).kind || 'Theorem', title: attrs(m[1]).title || '', body: m[2] }),
	toBlock: (d) => tag('Theorem', { kind: d.kind === 'Theorem' ? '' : d.kind, title: d.title }, d.body),
});

CMS.registerEditorComponent({
	id: 'proof',
	label: 'Proof',
	icon: 'check_box',
	fields: [{ name: 'body', label: 'Proof (Markdown, $math$ allowed)', widget: 'text' }],
	pattern: wrapped('Proof'),
	fromBlock: (m) => ({ body: m[2] }),
	toBlock: (d) => tag('Proof', {}, d.body),
});

CMS.registerEditorComponent({
	id: 'note',
	label: 'Note / Tip / Warning',
	icon: 'info',
	fields: [
		{ name: 'type', label: 'Type', widget: 'select', options: ['note', 'tip', 'warning'], default: 'note' },
		{ name: 'title', label: 'Title (optional)', widget: 'string', required: false },
		{ name: 'body', label: 'Text (Markdown)', widget: 'text' },
	],
	pattern: wrapped('Note'),
	fromBlock: (m) => ({ type: attrs(m[1]).type || 'note', title: attrs(m[1]).title || '', body: m[2] }),
	toBlock: (d) => tag('Note', { type: d.type === 'note' ? '' : d.type, title: d.title }, d.body),
});

CMS.registerEditorComponent({
	id: 'doccard',
	label: 'Document card (PDF)',
	icon: 'picture_as_pdf',
	fields: [
		{ name: 'title', label: 'Title', widget: 'string' },
		{ name: 'href', label: 'PDF link (our mirror)', widget: 'string' },
		{ name: 'source', label: "Publisher's page", widget: 'string' },
		{ name: 'size', label: 'Size (e.g. 1.8 MB)', widget: 'string', required: false },
		{ name: 'body', label: 'Description', widget: 'text' },
	],
	pattern: wrapped('DocCard'),
	fromBlock: (m) => ({ ...attrs(m[1]), body: m[2] }),
	toBlock: (d) => tag('DocCard', { title: d.title, href: d.href, source: d.source, size: d.size }, d.body),
});

CMS.registerEditorComponent({
	id: 'sidenote',
	label: 'Sidenote',
	icon: 'notes',
	fields: [{ name: 'body', label: 'Margin note (inline, mid-sentence)', widget: 'string' }],
	pattern: /<Sidenote>([^<]*)<\/Sidenote>/,
	fromBlock: (m) => ({ body: m[1] }),
	toBlock: (d) => `<Sidenote>${d.body ?? ''}</Sidenote>`,
});
