import { Moon, Sun } from 'lucide-react';

const KEY = 'pfims.theme';

function applyTheme(value) {
  document.documentElement.classList.toggle('dark', value === 'dark');
  localStorage.setItem(KEY, value);
}

export default function ThemeToggle({ compact = false }) {
  const isDark = (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) || false;
  return (
    <button
      type="button"
      onClick={() => applyTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/85 hover:bg-white/10 transition-colors"
    >
      {isDark ? <Sun size={14} /> : <Moon size={14} />}
      {!compact && <span>{isDark ? 'Light' : 'Dark'}</span>}
    </button>
  );
}
