import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeProviderContext {
	theme: Theme;
	setTheme: (theme: Theme) => void;
	actualTheme: 'light' | 'dark';
}

const ThemeProviderContext = createContext<ThemeProviderContext | undefined>(undefined);

export function ThemeProvider({ children, defaultTheme = 'system', storageKey = 'voiceloom.theme' }: { children: React.ReactNode; defaultTheme?: Theme; storageKey?: string; }) {
	const [theme, setTheme] = useState<Theme>(() => {
		if (typeof window !== 'undefined') {
			return (localStorage.getItem(storageKey) as Theme) || defaultTheme;
		}
		return defaultTheme;
	});

	const [actualTheme, setActualTheme] = useState<'light' | 'dark'>(() => {
		if (typeof window !== 'undefined') {
			if (theme === 'system') {
				return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
			}
			return theme === 'dark' ? 'dark' : 'light';
		}
		return 'light';
	});

	useEffect(() => {
		const root = window.document.documentElement;
		root.classList.remove('light', 'dark');

		let effectiveTheme: 'light' | 'dark';
		if (theme === 'system') {
			effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
		} else {
			effectiveTheme = theme;
		}

		root.classList.add(effectiveTheme);
		root.setAttribute('data-theme', effectiveTheme);
		setActualTheme(effectiveTheme);
	}, [theme]);

	useEffect(() => {
		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
		const handleChange = () => {
			if (theme === 'system') {
				const newTheme = mediaQuery.matches ? 'dark' : 'light';
				document.documentElement.classList.remove('light', 'dark');
				document.documentElement.classList.add(newTheme);
				document.documentElement.setAttribute('data-theme', newTheme);
				setActualTheme(newTheme);
			}
		};
		mediaQuery.addEventListener('change', handleChange);
		return () => mediaQuery.removeEventListener('change', handleChange);
	}, [theme]);

	const value = {
		theme,
		setTheme: (t: Theme) => {
			localStorage.setItem(storageKey, t);
			setTheme(t);
		},
		actualTheme,
	};

	return <ThemeProviderContext.Provider value={value}>{children}</ThemeProviderContext.Provider>;
}

export const useTheme = () => {
	const context = useContext(ThemeProviderContext);
	if (context === undefined) {
		throw new Error('useTheme must be used within a ThemeProvider');
	}
	return context;
};