/** Theme preference: light is the default. */
export type Theme = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'loan-tracker-theme-v2';

/** Read stored theme; invalid/missing values fall back to light. */
export function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

/** Apply theme to the document root (for CSS variables and color-scheme). */
export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.colorScheme = theme;
}
