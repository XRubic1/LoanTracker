/** Theme preference: dark is the default. */
export type Theme = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'loan-tracker-theme';

/** Read stored theme; invalid/missing values fall back to dark. */
export function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

/** Apply theme to the document root (for CSS variables and color-scheme). */
export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.colorScheme = theme;
}
