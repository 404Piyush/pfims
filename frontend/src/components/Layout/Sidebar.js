import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { clsx } from 'clsx';
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
  NewspaperIcon,
} from '@heroicons/react/24/outline';
import {
  HomeIcon as HomeIconSolid,
  CreditCardIcon as CreditCardIconSolid,
  TagIcon as TagIconSolid,
  ChartBarIcon as ChartBarIconSolid,
  DocumentChartBarIcon as DocumentChartBarIconSolid,
  BriefcaseIcon as BriefcaseIconSolid,
  BanknotesIcon as BanknotesIconSolid,
  PresentationChartLineIcon as PresentationChartLineIconSolid,
  UserIcon as UserIconSolid,
  Cog6ToothIcon as Cog6ToothIconSolid,
  ChatBubbleLeftRightIcon as ChatBubbleLeftRightIconSolid,
  NewspaperIcon as NewspaperIconSolid,
} from '@heroicons/react/24/solid';
import { toggleSidebar } from '../../store/slices/uiSlice';

const navigation = [
  {
    name: 'Dashboard',
    href: '/',
    icon: HomeIcon,
    iconSolid: HomeIconSolid,
  },
  {
    name: 'Transactions',
    href: '/transactions',
    icon: CreditCardIcon,
    iconSolid: CreditCardIconSolid,
  },
  {
    name: 'Categories',
    href: '/categories',
    icon: TagIcon,
    iconSolid: TagIconSolid,
  },
  {
    name: 'Budgets',
    href: '/budgets',
    icon: ChartBarIcon,
    iconSolid: ChartBarIconSolid,
  },
  {
    name: 'Reports',
    href: '/reports',
    icon: DocumentChartBarIcon,
    iconSolid: DocumentChartBarIconSolid,
  },
  {
    name: 'Portfolio',
    href: '/portfolio',
    icon: BriefcaseIcon,
    iconSolid: BriefcaseIconSolid,
  },
  {
    name: 'Stock Analysis',
    href: '/stocks/analyse',
    icon: PresentationChartLineIcon,
    iconSolid: PresentationChartLineIconSolid,
  },
  {
    name: 'Market News',
    href: '/market-news-intelligence',
    icon: NewspaperIcon,
    iconSolid: NewspaperIconSolid,
  },
  {
    name: 'Mutual Funds',
    href: '/mutual-funds',
    icon: BanknotesIcon,
    iconSolid: BanknotesIconSolid,
  },
  {
    name: 'Assistant',
    href: '/assistant',
    icon: ChatBubbleLeftRightIcon,
    iconSolid: ChatBubbleLeftRightIconSolid,
  },
];

const secondaryNavigation = [
  {
    name: 'Profile',
    href: '/profile',
    icon: UserIcon,
    iconSolid: UserIconSolid,
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Cog6ToothIcon,
    iconSolid: Cog6ToothIconSolid,
  },
];

const Sidebar = () => {
  const dispatch = useDispatch();
  const location = useLocation();
  const { sidebarOpen } = useSelector((state) => state.ui);
  const { user } = useSelector((state) => state.auth);

  const isActive = (href) => {
    if (href === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(href);
  };

  return (
    <>
      {/* Desktop sidebar */}
      <div className={clsx(
        'fixed inset-y-0 left-0 z-50 flex flex-col bg-white border-r border-secondary-200 transition-all duration-300',
        sidebarOpen ? 'w-64' : 'w-16',
        'hidden lg:flex'
      )}>
        {/* Logo and toggle */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-secondary-200">
          <div className={clsx(
            'flex items-center transition-opacity duration-300',
            sidebarOpen ? 'opacity-100' : 'opacity-0'
          )}>
            <div className="flex-shrink-0 h-8 w-8 rounded-lg overflow-hidden">
              <img
                src="/logo.png"
                alt="PFIMS Logo"
                className="h-8 w-8 object-contain"
              />
            </div>
            {sidebarOpen && (
              <span className="ml-3 text-xl font-bold text-secondary-900">
                PFIMS
              </span>
            )}
          </div>
          
          <button
            onClick={() => dispatch(toggleSidebar())}
            className="p-1.5 rounded-lg text-secondary-400 hover:text-secondary-600 hover:bg-secondary-100 transition-colors"
          >
            {sidebarOpen ? (
              <ChevronLeftIcon className="h-5 w-5" />
            ) : (
              <ChevronRightIcon className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const active = isActive(item.href);
            const Icon = active ? item.iconSolid : item.icon;
            
            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={clsx(
                  'group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                  active
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-secondary-600 hover:bg-secondary-100 hover:text-secondary-900'
                )}
                title={!sidebarOpen ? item.name : undefined}
              >
                <Icon className="flex-shrink-0 h-5 w-5" />
                {sidebarOpen && (
                  <span className="ml-3 truncate">{item.name}</span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Secondary navigation */}
        <div className="px-3 py-4 border-t border-secondary-200">
          <div className="space-y-1">
            {secondaryNavigation.map((item) => {
              const active = isActive(item.href);
              const Icon = active ? item.iconSolid : item.icon;
              
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={clsx(
                    'group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                    active
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-secondary-600 hover:bg-secondary-100 hover:text-secondary-900'
                  )}
                  title={!sidebarOpen ? item.name : undefined}
                >
                  <Icon className="flex-shrink-0 h-5 w-5" />
                  {sidebarOpen && (
                    <span className="ml-3 truncate">{item.name}</span>
                  )}
                </NavLink>
              );
            })}
          </div>
        </div>

        {/* User profile */}
        {sidebarOpen && user && (
          <div className="px-3 py-4 border-t border-secondary-200">
            <div className="flex items-center">
              <div className="flex-shrink-0 h-8 w-8 bg-primary-600 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-white">
                  {user.firstName?.[0]?.toUpperCase() || 'U'}
                </span>
              </div>
              <div className="ml-3 min-w-0 flex-1">
                <p className="text-sm font-medium text-secondary-900 truncate">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs text-secondary-500 truncate">
                  {user.email}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile sidebar */}
      <div className={clsx(
        'fixed inset-y-0 left-0 z-50 flex flex-col w-64 bg-white border-r border-secondary-200 transform transition-transform duration-300 lg:hidden',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Logo */}
        <div className="flex items-center h-16 px-4 border-b border-secondary-200">
          <div className="flex-shrink-0 h-8 w-8 rounded-lg overflow-hidden">
            <img
              src="/logo.png"
              alt="PFIMS Logo"
              className="h-8 w-8 object-contain"
            />
          </div>
          <span className="ml-3 text-xl font-bold text-secondary-900">
            PFIMS
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const active = isActive(item.href);
            const Icon = active ? item.iconSolid : item.icon;
            
            return (
              <NavLink
                key={item.name}
                to={item.href}
                onClick={() => dispatch(toggleSidebar())}
                className={clsx(
                  'group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                  active
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-secondary-600 hover:bg-secondary-100 hover:text-secondary-900'
                )}
              >
                <Icon className="flex-shrink-0 h-5 w-5" />
                <span className="ml-3 truncate">{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Secondary navigation */}
        <div className="px-3 py-4 border-t border-secondary-200">
          <div className="space-y-1">
            {secondaryNavigation.map((item) => {
              const active = isActive(item.href);
              const Icon = active ? item.iconSolid : item.icon;
              
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  onClick={() => dispatch(toggleSidebar())}
                  className={clsx(
                    'group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                    active
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-secondary-600 hover:bg-secondary-100 hover:text-secondary-900'
                  )}
                >
                  <Icon className="flex-shrink-0 h-5 w-5" />
                  <span className="ml-3 truncate">{item.name}</span>
                </NavLink>
              );
            })}
          </div>
        </div>

        {/* User profile */}
        {user && (
          <div className="px-3 py-4 border-t border-secondary-200">
            <div className="flex items-center">
              <div className="flex-shrink-0 h-8 w-8 bg-primary-600 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-white">
                  {user.firstName?.[0]?.toUpperCase() || 'U'}
                </span>
              </div>
              <div className="ml-3 min-w-0 flex-1">
                <p className="text-sm font-medium text-secondary-900 truncate">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs text-secondary-500 truncate">
                  {user.email}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Sidebar;
