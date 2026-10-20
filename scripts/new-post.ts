// Usage: bun run new "My post title"
// Creates src/content/posts/<slug>.mdx as a draft dated today.
import { existsSync, writeFileSync } from 'node:fs';

const title = process.argv.slice(2).join(' ').trim();
if (!title) {
	console.error('Usage: bun run new "Post title"');
	process.exit(1);
}

const slug = title
	.toLowerCase()
	.normalize('NFKD')
	.replace(/[̀-ͯ]/g, '') // strip accents
	.replace(/[^a-z0-9]+/g, '-')
	.replace(/^-|-$/g, '');
const file = `src/content/posts/${slug}.mdx`;

if (existsSync(file)) {
	console.error(`${file} already exists`);
	process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
writeFileSync(
	file,
	`---
title: ${JSON.stringify(title)}
description: ''
date: ${today}
tags: []
draft: true
---

Write here. Drafts show up under \`bun run dev\` but never in a build.
`,
);
console.log(`Created ${file}`);
