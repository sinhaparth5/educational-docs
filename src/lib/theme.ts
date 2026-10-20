import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

// Canvas libs can't read CSS variables, so islands get the theme as plain colors
export const palette = {
	light: { bg: '#f8f6f1', fg: '#4a4640', grid: '#dcd8cf', accent: '#2c6e69' },
	dark: { bg: '#1c1b19', fg: '#b8b3a8', grid: '#3a3833', accent: '#8fc3ba' },
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
