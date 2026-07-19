import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import clsx from 'clsx';
import {
  HomeIcon,
  CreditCardIcon,
  TagIcon,
  ChartBarIcon,
  DocumentChartBarIcon,
  BriefcaseIcon,
  BanknotesIcon,
  PresentationChartLineIcon,
  UserIcon,
  Cog6ToothIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';
import { toggleSidebar } from '../../store/slices/uiSlice';

const navigation = [
  { name: 'Dashboard',         href: '/',                   icon: HomeIcon },
  { name: 'Transactions',      href: '/transactions',       icon: CreditCardIcon },
  { name: 'Categories',        href: '/categories',         icon: TagIcon },
  { name: 'Budgets',           href: '/budgets',            icon: ChartBarIcon },
  { name: 'Reports',           href: '/reports',            icon: DocumentChartBarIcon },
  { name: 'Portfolio',         href: '/portfolio',          icon: BriefcaseIcon },
  { name: 'Stock Analysis',    href: '/stocks/analyse',     icon: PresentationChartLineIcon },
  { name: 'Mutual Funds',      href: '/mutual-funds',       icon: BanknotesIcon },
  { name: 'Assistant',         href: '/assistant',          icon: ChatBubbleLeftRightIcon },
];

const secondaryNavigation = [
  { name: 'Profile',  href: '/profile',  icon: UserIcon },
  { name: 'Settings', href: '/settings', icon: Cog6ToothIcon },
];

const ringStyle = {
  // thin double-stroke to nod at the brutalist borders without breaking minimalist layout
  boxShadow: 'inset 0 0 0 1px rgba(15, 23, 42, 0.06)',
};

function NavItem({ item, collapsed, onClick }) {
  const Icon = item.icon;
  return (
    <NavLink
      key={item.name}
      to={item.href}
      onClick={onClick}
      title={collapsed ? item.name : undefined}
      className={({ isActive }) =>
        clsx(
          'group relative flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
          isActive
            ? 'bg-brand-indigo-soft text-brand-indigo-deep ring-1 ring-brand-indigo/30'
            : 'text-ink-700 hover:bg-ink-100 hover:text-ink-950 dark:text-white/75 dark:hover:bg-white/5 dark:hover:text-white'
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span
              aria-hidden
              className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-brand-indigo"
            />
          )}
          <Icon className="flex-shrink-0 h-5 w-5" />
          {!collapsed && <span className="ml-3 truncate">{item.name}</span>}
        </>
      )}
    </NavLink>
  );
}

const Sidebar = () => {
  const dispatch = useDispatch();
  const location = useLocation();
  const { sidebarOpen } = useSelector((state) => state.ui);
  const { user } = useSelector((state) => state.auth);

  const isActive = (href) =>
    href === '/' ? location.pathname === '/' : location.pathname.startsWith(href);

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 hidden lg:flex flex-col bg-white dark:bg-ink-950 border-r border-ink-900/10 dark:border-white/10 transition-all duration-300',
          sidebarOpen ? 'w-64' : 'w-16'
        )}
        style={ringStyle}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-ink-900/10 dark:border-white/10">
          <div className={clsx('flex items-center transition-opacity duration-300', sidebarOpen ? 'opacity-100' : 'opacity-0')}>
            <div className="flex-shrink-0 h-8 w-8 rounded-md overflow-hidden ring-1 ring-ink-900/10 dark:ring-white/20">
              <img src="/logo.png" alt="PFIMS Logo" className="h-8 w-8 object-contain" />
            </div>
            {sidebarOpen && (
              <span className="ml-3 text-lg font-display font-bold tracking-tight text-ink-950 dark:text-white">
                PFIMS
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => dispatch(toggleSidebar())}
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            className="p-1.5 rounded-md text-ink-500 hover:text-ink-900 hover:bg-ink-100 dark:text-white/60 dark:hover:bg-white/5 dark:hover:text-white transition-colors"
          >
            {sidebarOpen ? <ChevronLeftIcon className="h-5 w-5" /> : <ChevronRightIcon className="h-5 w-5" />}
          </button>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
          {navigation.map((item) => (
            <NavItem key={item.name} item={item} collapsed={!sidebarOpen} />
          ))}
        </nav>

        <div className="px-2 py-4 border-t border-ink-900/10 dark:border-white/10 space-y-0.5">
          {secondaryNavigation.map((item) => (
            <NavItem key={item.name} item={item} collapsed={!sidebarOpen} />
          ))}
        </div>

        {sidebarOpen && user && (
          <div className="px-4 py-4 border-t border-ink-900/10 dark:border-white/10">
            <div className="flex items-center">
              <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-brand-indigo to-brand-pink text-white flex items-center justify-center">
                <span className="text-sm font-semibold">
                  {user.firstName?.[0]?.toUpperCase() || 'U'}
                </span>
              </div>
              <div className="ml-3 min-w-0 flex-1">
                <p className="text-sm font-medium text-ink-950 dark:text-white truncate">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs text-ink-500 dark:text-white/55 truncate tabular-nums">
                  {user.email}
                </p>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Mobile sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 flex flex-col w-64 bg-white dark:bg-ink-950 border-r border-ink-900/10 dark:border-white/10 transform transition-transform duration-300 lg:hidden',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        style={ringStyle}
      >
        <div className="flex items-center h-16 px-4 border-b border-ink-900/10 dark:border-white/10">
          <div className="flex-shrink-0 h-8 w-8 rounded-md overflow-hidden ring-1 ring-ink-900/10 dark:ring-white/20">
            <img src="/logo.png" alt="PFIMS Logo" className="h-8 w-8 object-contain" />
          </div>
          <span className="ml-3 text-lg font-display font-bold tracking-tight text-ink-950 dark:text-white">
            PFIMS
          </span>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
          {navigation.map((item) => (
            <NavItem key={item.name} item={item} collapsed={false} onClick={() => dispatch(toggleSidebar())} />
          ))}
        </nav>

        <div className="px-2 py-4 border-t border-ink-900/10 dark:border-white/10 space-y-0.5">
          {secondaryNavigation.map((item) => (
            <NavItem key={item.name} item={item} collapsed={false} onClick={() => dispatch(toggleSidebar())} />
          ))}
        </div>

        {user && (
          <div className="px-4 py-4 border-t border-ink-900/10 dark:border-white/10">
            <div className="flex items-center">
              <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-brand-indigo to-brand-pink text-white flex items-center justify-center">
                <span className="text-sm font-semibold">
                  {user.firstName?.[0]?.toUpperCase() || 'U'}
                </span>
              </div>
              <div className="ml-3 min-w-0 flex-1">
                <p className="text-sm font-medium text-ink-950 dark:text-white truncate">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs text-ink-500 dark:text-white/55 truncate tabular-nums">
                  {user.email}
                </p>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};

export default Sidebar;
