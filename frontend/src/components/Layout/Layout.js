import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { toggleSidebar } from '../../store/slices/uiSlice';
import { Command, Search } from 'lucide-react';
import Sidebar from './Sidebar';
import Header from './Header';
import CommandPalette from '../ui/CommandPalette';
import ThemeToggle from '../ui/ThemeToggle';
import MotionToggle from '../ui/MotionToggle';
import DensityToggle from '../ui/DensityToggle';

const DENSITY_KEY = 'pfims.density';
const MOTION_KEY = 'pfims.motion';

function applyStoredPreferences() {
  if (typeof document === 'undefined') return;
  if (localStorage.getItem(DENSITY_KEY) === 'compact') {
    document.documentElement.classList.add('density-compact');
  }
  if (localStorage.getItem(MOTION_KEY) === 'reduced' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.documentElement.classList.add('reduce-motion');
  }
  // Paint `body.aurora`/`body.brutal` helper classes on remove
  // (AuroraScreen / BrutalistScreen manage those per route).
}

function FloatingToolbar() {
  // Tiny ephemeral state — opens the palette externally via a global handler.
  React.useEffect(() => {
    applyStoredPreferences();
  }, []);
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[60] flex items-center gap-2">
      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent('pfims:open-palette'))}
        className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-ink-900/10 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 shadow-sm hover:bg-ink-50 transition-colors dark:border-white/10 dark:bg-zinc-900/80 dark:text-white/85 dark:hover:bg-zinc-800"
        aria-label="Open command palette"
      >
        <Search size={14} />
        <span>Search</span>
        <span className="ml-1 flex items-center gap-1 text-[10px] text-ink-500 dark:text-white/50">
          <Command size={10} /> K
        </span>
      </button>
      <div className="pointer-events-auto hidden md:flex items-center gap-2 rounded-full border border-ink-900/10 bg-white/90 px-2 py-1 shadow-sm backdrop-blur dark:border-white/10 dark:bg-zinc-900/70">
        <ThemeToggle compact />
        <DensityToggle compact />
        <MotionToggle />
      </div>
    </div>
  );
}

const Layout = () => {
  const dispatch = useDispatch();
  const { sidebarOpen } = useSelector((state) => state.ui);

  useEffect(() => {
    applyStoredPreferences();
  }, []);

  return (
    <div className="min-h-screen bg-secondary-50 dark:bg-ink-950">
      <Sidebar />
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => dispatch(toggleSidebar())}
        />
      )}

      <div
        className={`transition-all duration-300 ${
          sidebarOpen ? 'lg:ml-64' : 'lg:ml-16'
        }`}
      >
        <Header />
        <main className="px-4 sm:px-6 lg:px-8 py-6">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      <FloatingToolbar />
      <CommandPalette />
    </div>
  );
};

export default Layout;
