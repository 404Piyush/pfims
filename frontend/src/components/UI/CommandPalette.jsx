import { useEffect, useMemo, useState } from 'react';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { logout } from '../../store/slices/authSlice';
import {
  LayoutDashboard,
  Repeat,
  FolderTree,
  Wallet,
  BarChart3,
  Bot,
  Briefcase,
  LineChart,
  User,
  Settings,
  LogOut,
  Sun,
  Moon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Pinned the same items as the sidebar so ⌘K and clicks stay in sync.
const ACTIONS = [
  { id: 'go-dashboard', label: 'Go to Dashboard', icon: LayoutDashboard, run: '/', keywords: ['home'] },
  { id: 'go-transactions', label: 'Transactions', icon: Repeat, run: '/transactions' },
  { id: 'go-new-tx', label: 'New Transaction', icon: Repeat, run: '/transactions/new' },
  { id: 'go-categories', label: 'Categories', icon: FolderTree, run: '/categories' },
  { id: 'go-budgets', label: 'Budgets', icon: Wallet, run: '/budgets' },
  { id: 'go-reports', label: 'Reports', icon: BarChart3, run: '/reports' },
  { id: 'go-assistant', label: 'AI Assistant', icon: Bot, run: '/assistant', keywords: ['chat', 'chatbot'] },
  { id: 'go-portfolio', label: 'Portfolio', icon: Briefcase, run: '/portfolio' },
  { id: 'go-stocks', label: 'Stock analysis', icon: LineChart, run: '/stocks/analyse' },
  { id: 'go-profile', label: 'Profile', icon: User, run: '/profile' },
  { id: 'go-settings', label: 'Settings', icon: Settings, run: '/settings' },
];

function readThemePreference() {
  if (typeof window === 'undefined') return 'light';
  return localStorage.getItem('pfims.theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

function applyTheme(theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  localStorage.setItem('pfims.theme', theme);
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const allItems = useMemo(() => {
    const theme = readThemePreference();
    return [
      ...ACTIONS,
      {
        id: 'theme-toggle',
        label: theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
        icon: theme === 'dark' ? Sun : Moon,
        keywords: ['appearance', 'mode'],
        run: () => applyTheme(theme === 'dark' ? 'light' : 'dark'),
      },
      {
        id: 'logout',
        label: 'Log out',
        icon: LogOut,
        keywords: ['sign out'],
        run: async () => {
          await dispatch(logout());
          navigate('/login');
        },
      },
    ];
  }, [dispatch, navigate]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    const onExternal = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('pfims:open-palette', onExternal);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pfims:open-palette', onExternal);
    };
  }, []);

  const handleSelect = (item) => {
    setOpen(false);
    if (typeof item.run === 'string') navigate(item.run);
    else if (typeof item.run === 'function') Promise.resolve(item.run()).catch(() => {});
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[14vh] bg-black/40 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
            className="w-[640px] max-w-[92vw] overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/85 shadow-2xl backdrop-blur-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Command label="Command palette">
              <Command.Input
                placeholder="Type a command or search…"
                className="w-full bg-transparent px-5 py-4 text-base text-white placeholder:text-white/40 focus:outline-none"
              />
              <Command.List className="max-h-[60vh] overflow-y-auto px-2 pb-3">
                <Command.Empty className="px-4 py-6 text-center text-white/50 text-sm">
                  No results.
                </Command.Empty>
                <Command.Group heading="Navigate" className="px-2 pt-1">
                  {ACTIONS.map((a) => (
                    <CommandItem key={a.id} item={a} onSelect={handleSelect} />
                  ))}
                </Command.Group>
                <Command.Group heading="Account" className="px-2 pt-1">
                  {allItems
                    .filter((i) => i.id === 'theme-toggle' || i.id === 'logout')
                    .map((a) => (
                      <CommandItem key={a.id} item={a} onSelect={handleSelect} />
                    ))}
                </Command.Group>
              </Command.List>
            </Command>
            <div className="flex items-center justify-between border-t border-white/10 bg-black/40 px-4 py-2 text-[11px] text-white/50">
              <span>
                <kbd className="px-1 py-0.5 rounded bg-white/10">↵</kbd> select&nbsp;&nbsp;
                <kbd className="px-1 py-0.5 rounded bg-white/10">esc</kbd> close
              </span>
              <span>PFIMS palette</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CommandItem({ item, onSelect }) {
  const Icon = item.icon;
  return (
    <Command.Item
      value={`${item.label} ${(item.keywords || []).join(' ')}`}
      onSelect={() => onSelect(item)}
      className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/85 data-[selected=true]:bg-white/10"
    >
      <Icon size={16} className="shrink-0 text-white/60" />
      <span>{item.label}</span>
    </Command.Item>
  );
}
