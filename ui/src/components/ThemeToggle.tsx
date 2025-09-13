const KEY = 'voiceloom.theme';

function getCurrentTheme(): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'light';
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'dark') return 'dark';
  return 'light';
}

export default function ThemeToggle() {
  const theme = getCurrentTheme();
  const isDark = theme === 'dark';

  const toggle = () => {
    const next = getCurrentTheme() === 'dark' ? 'light' : 'dark';
    const root = document.documentElement;
    root.setAttribute('data-theme', next);
    // Optionally also toggle 'dark' class for any Tailwind dark: utilities
    if (next === 'dark') root.classList.add('dark'); else root.classList.remove('dark');
    try { localStorage.setItem(KEY, next); } catch {}
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="btn btn-ghost btn-sm"
      aria-label="Toggle dark mode"
    >
      {isDark ? (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.364 6.364-1.414-1.414M8.05 8.05 6.636 6.636m0 10.728 1.414-1.414m9.9-9.9-1.414 1.414" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
          <path d="M21 12.79A9 9 0 0 1 11.21 3 7 7 0 1 0 21 12.79Z" />
        </svg>
      )}
    </button>
  );
}
