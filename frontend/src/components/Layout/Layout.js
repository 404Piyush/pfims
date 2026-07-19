import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { toggleSidebar } from '../../store/slices/uiSlice';
import { Command, Search } from 'lucide-react';
import Sidebar from './Sidebar';
import Header from './Header';
import CommandPalette from '../ui/CommandPalette';

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
}

function FloatingToolbar() {
  React.useEffect(() => {
    applyStoredPreferences();
  }, []);
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[60] flex items-center gap-2">
      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent('pfims:open-palette'))}
        className="pointer-events-auto inline-flex items-center gap-2 bg-brutal-paper border-2 border-brutal-ink px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-brutal-ink shadow-[3px_3px_0_0_#0a0a0a] hover:shadow-[1px_1px_0_0_#0a0a0a] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[3px] active:translate-y-[3px] transition-all"
        aria-label="Open command palette"
      >
        <Search size={14} />
        <span>Search</span>
        <span className="ml-1 inline-flex items-center gap-0.5 text-[10px] text-brutal-ink/70 border border-brutal-ink px-1">
          <Command size={9} />K
        </span>
      </button>
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
    <div className="min-h-screen bg-brutal-paper text-brutal-ink">
      <Sidebar />
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-brutal-ink/40 lg:hidden"
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