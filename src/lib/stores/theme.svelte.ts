type Theme = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'artifactory-theme';

function getInitialTheme(): Theme {
	if (typeof window === 'undefined') return 'system';
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
	} catch {
		// localStorage may not be available
	}
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

function createThemeStore() {
	let theme = $state<Theme>(getInitialTheme());
	let resolved = $derived<ResolvedTheme>(theme === 'system' ? getSystemTheme() : theme);

	$effect.root(() => {
		$effect(() => {
			applyTheme(resolved);
			if (typeof window !== 'undefined') {
				localStorage.setItem(STORAGE_KEY, theme);
			}
		});
	});

	return {
		get theme() {
			return theme;
		},
		get resolvedTheme() {
			return resolved;
		},
		toggleTheme() {
			if (theme === 'dark') {
				theme = 'light';
			} else if (theme === 'light') {
				theme = 'system';
			} else {
				theme = 'dark';
			}
		}
	};
}

export const themeStore = createThemeStore();
export const theme = {
	get value() {
		return themeStore.theme;
	}
};
export const resolvedTheme = {
	get value() {
		return themeStore.resolvedTheme;
	}
};
export const toggleTheme = () => themeStore.toggleTheme();

export type { Theme, ResolvedTheme };
