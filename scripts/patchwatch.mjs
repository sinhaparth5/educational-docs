// Reports the Node version and installed packages (from bun.lock) to Patchwatch.
// Run from CI after a deploy; does nothing unless PATCHWATCH_URL and PATCHWATCH_TOKEN are set.
import { readFile } from 'node:fs/promises';

const { PATCHWATCH_URL: url, PATCHWATCH_TOKEN: token } = process.env;

async function manifest() {
	// bun.lock is JSON with trailing commas
	const lock = JSON.parse((await readFile('bun.lock', 'utf8')).replace(/,(\s*[}\]])/g, '$1'));
	const npm = Object.entries(lock.packages)
		// hoisted packages only ("astro", "@astrojs/mdx"); nested copies are "parent/child"
		.filter(([key]) => /^(@[^/]+\/)?[^/]+$/.test(key))
		.map(([name, [spec]]) => ({ ecosystem: 'npm', name, version: spec.slice(spec.lastIndexOf('@') + 1) }));
	return [{ ecosystem: 'runtime', name: 'node', version: process.version }, ...npm].slice(0, 5000);
}

if (url && token) {
	try {
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json',
				Accept: 'application/json',
			},
			body: JSON.stringify({ dependencies: await manifest() }),
			signal: AbortSignal.timeout(15_000),
		});
		if (!response.ok) console.warn(`patchwatch: heartbeat failed with ${response.status}`, await response.text());
	} catch (error) {
		console.warn('patchwatch: heartbeat failed', error.message); // never fail the deploy over monitoring
	}
}
