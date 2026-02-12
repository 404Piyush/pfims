import { useState, useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  Bars3Icon,
  BellIcon,
  UserIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { toggleSidebar } from '../../store/slices/uiSlice';
import { logout } from '../../store/slices/authSlice';
import { getBudgetAlerts, markAlertAsRead, clearAlerts } from '../../store/slices/budgetSlice';

const Header = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const { alerts, alertsLoading } = useSelector((state) => state.budgets);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const userMenuRef = useRef(null);
  const notificationsRef = useRef(null);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setNotificationsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    dispatch(logout());
    setUserMenuOpen(false);
  };

  const alertKey = (a) => String(a?.id || a?._id || '');
  const unreadCount = Array.isArray(alerts) ? alerts.filter((a) => !a?.isRead && alertKey(a)).length : 0;

  const formatAlertLine = (a) => {
    const utilization = typeof a?.utilizationPercentage === 'number' ? `${a.utilizationPercentage.toFixed(1)}%` : '';
    const category = a?.categoryName ? ` • ${a.categoryName}` : '';
    const kind = a?.type === 'over_budget' ? 'Over budget' : 'Budget alert';
    const suffix = utilization ? ` • ${utilization}` : '';
    return `${kind}${category}${suffix}`.trim();
  };

  const formatAlertTime = (a) => {
    const d = a?.createdAt ? new Date(a.createdAt) : null;
    if (!d || Number.isNaN(d.getTime())) return '';
    return d.toLocaleString();
  };

  const toggleNotifications = () => {
    setNotificationsOpen((prev) => {
      const next = !prev;
      if (next) {
        dispatch(getBudgetAlerts());
      }
      return next;
    });
  };

  const handleMarkAllRead = () => {
    if (!Array.isArray(alerts)) return;
    alerts.forEach((a) => {
      const key = alertKey(a);
      if (key && !a?.isRead) dispatch(markAlertAsRead(key));
    });
  };

  const userMenuItems = [
    {
      name: 'Profile',
      icon: UserIcon,
      onClick: () => {
        navigate('/profile');
        setUserMenuOpen(false);
      },
    },
    {
      name: 'Settings',
      icon: Cog6ToothIcon,
      onClick: () => {
        navigate('/settings');
        setUserMenuOpen(false);
      },
    },
    {
      name: 'Sign out',
      icon: ArrowRightOnRectangleIcon,
      onClick: handleLogout,
      className: 'text-danger-600 hover:text-danger-700 hover:bg-danger-50',
    },
  ];

  return (
    <header className="bg-white border-b border-secondary-200 sticky top-0 z-30">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left side */}
          <div className="flex items-center space-x-4">
            {/* Mobile menu button */}
            <button
              onClick={() => dispatch(toggleSidebar())}
              className="p-2 rounded-lg text-secondary-400 hover:text-secondary-600 hover:bg-secondary-100 transition-colors lg:hidden"
            >
              <Bars3Icon className="h-6 w-6" />
            </button>
          </div>

          {/* Right side */}
          <div className="flex items-center space-x-4">
            {/* Notifications */}
            <div className="relative" ref={notificationsRef}>
              <button
                type="button"
                onClick={toggleNotifications}
                className="relative p-2 rounded-lg text-secondary-400 hover:text-secondary-600 hover:bg-secondary-100 transition-colors"
              >
                <BellIcon className="h-6 w-6" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 h-2 w-2 bg-danger-500 rounded-full"></span>
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-secondary-200 z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-secondary-200 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-secondary-900">Alerts</div>
                      <div className="text-xs text-secondary-600">
                        {unreadCount > 0 ? `${unreadCount} unread` : 'No unread alerts'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => dispatch(getBudgetAlerts())}
                        className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                        disabled={alertsLoading}
                      >
                        Refresh
                      </button>
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        className="text-xs text-secondary-700 hover:text-secondary-900 font-medium"
                        disabled={unreadCount === 0}
                      >
                        Mark all read
                      </button>
                    </div>
                  </div>

                  <div className="max-h-80 overflow-y-auto">
                    {alertsLoading && (!Array.isArray(alerts) || alerts.length === 0) ? (
                      <div className="px-4 py-4 text-sm text-secondary-600">Loading alerts…</div>
                    ) : (!Array.isArray(alerts) || alerts.length === 0) ? (
                      <div className="px-4 py-4 text-sm text-secondary-600">No budget alerts right now.</div>
                    ) : (
                      <div className="divide-y divide-secondary-100">
                        {alerts.slice(0, 8).map((a) => {
                          const key = alertKey(a);
                          const isUnread = !a?.isRead;
                          return (
                            <div key={key || `${a?.budgetId}-${a?.categoryId}`} className="px-4 py-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className={clsx('text-sm font-medium truncate', isUnread ? 'text-secondary-900' : 'text-secondary-700')}>
                                    {a?.budgetName || 'Budget'}
                                  </div>
                                  <div className="text-xs text-secondary-600">
                                    {formatAlertLine(a)}
                                  </div>
                                  {a?.createdAt && (
                                    <div className="text-xs text-secondary-500 mt-1">{formatAlertTime(a)}</div>
                                  )}
                                </div>
                                {isUnread && key && (
                                  <button
                                    type="button"
                                    onClick={() => dispatch(markAlertAsRead(key))}
                                    className="text-xs text-primary-600 hover:text-primary-700 font-medium whitespace-nowrap"
                                  >
                                    Mark read
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="px-4 py-3 border-t border-secondary-200 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        dispatch(clearAlerts());
                        setNotificationsOpen(false);
                      }}
                      className="text-xs text-secondary-700 hover:text-secondary-900 font-medium"
                      disabled={!Array.isArray(alerts) || alerts.length === 0}
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        navigate('/budgets');
                        setNotificationsOpen(false);
                      }}
                      className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                    >
                      View all
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* User menu */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center space-x-3 p-2 rounded-lg text-secondary-700 hover:bg-secondary-100 transition-colors"
              >
                <div className="flex-shrink-0 h-8 w-8 bg-primary-600 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-white">
                    {user?.firstName?.[0]?.toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-medium text-secondary-900">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-xs text-secondary-500">
                    {user?.email}
                  </p>
                </div>
                <ChevronDownIcon className={clsx(
                  'h-4 w-4 text-secondary-400 transition-transform',
                  userMenuOpen && 'rotate-180'
                )} />
              </button>

              {/* Dropdown menu */}
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-secondary-200 py-1 z-50">
                  {/* User info */}
                  <div className="px-4 py-3 border-b border-secondary-200 md:hidden">
                    <p className="text-sm font-medium text-secondary-900">
                      {user?.firstName} {user?.lastName}
                    </p>
                    <p className="text-xs text-secondary-500 truncate">
                      {user?.email}
                    </p>
                  </div>

                  {/* Menu items */}
                  {userMenuItems.map((item) => (
                    <button
                      key={item.name}
                      onClick={item.onClick}
                      className={clsx(
                        'w-full flex items-center px-4 py-2 text-sm transition-colors',
                        item.className || 'text-secondary-700 hover:text-secondary-900 hover:bg-secondary-50'
                      )}
                    >
                      <item.icon className="h-4 w-4 mr-3" />
                      {item.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
