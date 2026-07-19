import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import AuroraScreen from '../../components/layout/AuroraScreen';
import AuroraCard from '../../components/ui/AuroraCard';

const NotFound = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useSelector((state) => state.auth);

  return (
    <AuroraScreen>
      <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <AuroraCard accent="pink" className="max-w-lg w-full p-10 text-center">
          <div className="mb-6">
            <h1 className="text-7xl font-extrabold tracking-tighter bg-gradient-to-r from-brand-indigo via-brand-cyan to-brand-pink bg-clip-text text-transparent">
              404
            </h1>
            <h2 className="mt-3 text-2xl font-semibold text-white">Page not found</h2>
            <p className="mt-2 text-white/70 max-w-md mx-auto">
              Sorry, we couldn't find the page you're looking for. It may have been moved
              or you typed the URL wrong.
            </p>
          </div>

          <div className="space-y-3 sm:space-y-0 sm:space-x-3 sm:flex sm:justify-center">
            <button
              onClick={() => navigate(-1)}
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-5 py-2 text-sm font-medium text-white hover:bg-white/10"
            >
              Go back
            </button>
            <Link
              to={isAuthenticated ? '/' : '/login'}
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-full bg-white px-5 py-2 text-sm font-semibold text-ink-900 hover:bg-white/90"
            >
              {isAuthenticated ? 'Go to Dashboard' : 'Go to Login'}
            </Link>
          </div>

          <div className="mt-8 pt-6 border-t border-white/10">
            <p className="text-xs uppercase tracking-[0.18em] text-white/50 mb-3">
              Popular pages
            </p>
            <div className="flex flex-wrap justify-center gap-3 text-sm">
              {(isAuthenticated
                ? ['/transactions', '/budgets', '/reports', '/profile']
                : ['/login', '/register', '/forgot-password']
              ).map((to) => (
                <Link
                  key={to}
                  to={to}
                  className="rounded-full border border-white/10 px-3 py-1 text-white/80 hover:text-white hover:border-white/30 transition-colors"
                >
                  {to.replace('/', '').replace('-', ' ')}
                </Link>
              ))}
            </div>
          </div>
        </AuroraCard>
      </div>
    </AuroraScreen>
  );
};

export default NotFound;
