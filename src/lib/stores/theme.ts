type Theme = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'artifactory-theme';

function getInitialTheme(): Theme {
	if (typeof localStorage === 'undefined') return 'system';
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
	return 'system';
}

function getSystemTheme(): ResolvedTheme {
	if (typeof window === 'undefined') return 'dark';
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(resolved: ResolvedTheme) {
	if (typeof document === 'undefined') return;
	if (resolved === 'dark') {
		document.documentElement.classList.add('dark');
	} else {
		document.documentElement.classList.remove('dark');
	}
}

// Svelte 5 rune-based theme store
let theme = $state<Theme>(getInitialTheme());

let resolvedTheme = $derived<ResolvedTheme>(theme === 'system' ? getSystemTheme() : theme);

$effect.root(() => {
	$effect(() => {
		applyTheme(resolvedTheme);
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(STORAGE_KEY, theme);
		}
	});
});

function toggleTheme() {
	if (theme === 'dark') {
		theme = 'light';
	} else if (theme === 'light') {
		theme = 'system';
	} else {
		theme = 'dark';
	}
}

export { theme, resolvedTheme, toggleTheme };
export type { Theme, ResolvedTheme };
