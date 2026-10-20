import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

// Canvas libs can't read CSS variables, so islands get the theme as plain colors
export const palette = {
	light: { bg: '#f5f5f5', fg: '#404040', grid: '#d4d4d4', accent: '#006cac' },
	dark: { bg: '#171717', fg: '#bfbfbf', grid: '#404040', accent: '#ff6b01' },
};

const current = (): Theme =>
	document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';

/** Tracks <html data-theme>, re-rendering when the header toggle flips it. */
export function useTheme(): Theme {
	// Islands render nothing theme-dependent on the server, so reading the DOM here is safe
	const [theme, setTheme] = useState<Theme>(() =>
		typeof document === 'undefined' ? 'light' : current(),
	);
	useEffect(() => {
		const observer = new MutationObserver(() => setTheme(current()));
		observer.observe(document.documentElement, { attributeFilter: ['data-theme'] });
		return () => observer.disconnect();
	}, []);
	return theme;
}
