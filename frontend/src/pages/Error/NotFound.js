import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

const NotFound = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useSelector((state) => state.auth);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-100 flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-lg w-full text-center">
        {/* 404 Illustration */}
        <div className="mb-8">
          <div className="mx-auto h-32 w-32 bg-primary-100 rounded-full flex items-center justify-center mb-6">
            <svg
              className="h-16 w-16 text-primary-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-3-8a9 9 0 110 18 9 9 0 010-18z"
              />
            </svg>
          </div>
          
          <h1 className="text-6xl font-bold text-primary-600 mb-2">404</h1>
          <h2 className="text-2xl font-semibold text-secondary-900 mb-4">
            Page Not Found
          </h2>
          <p className="text-secondary-600 mb-8 max-w-md mx-auto">
            Sorry, we couldn't find the page you're looking for. The page might have been moved, deleted, or you entered the wrong URL.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-4 sm:space-y-0 sm:space-x-4 sm:flex sm:justify-center">
          <button
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto btn-outline"
          >
            <svg
              className="h-4 w-4 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Go Back
          </button>
          
          <Link
            to={isAuthenticated ? "/" : "/login"}
            className="w-full sm:w-auto btn-primary inline-flex items-center justify-center"
          >
            <svg
              className="h-4 w-4 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
            {isAuthenticated ? 'Go to Dashboard' : 'Go to Login'}
          </Link>
        </div>

        {/* Help Links */}
        <div className="mt-12 pt-8 border-t border-secondary-200">
          <p className="text-sm text-secondary-500 mb-4">
            Need help? Try these popular pages:
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            {isAuthenticated ? (
              <>
                <Link
                  to="/transactions"
                  className="text-primary-600 hover:text-primary-700 transition-colors"
                >
                  Transactions
                </Link>
                <Link
                  to="/budgets"
                  className="text-primary-600 hover:text-primary-700 transition-colors"
                >
                  Budgets
                </Link>
                <Link
                  to="/reports"
                  className="text-primary-600 hover:text-primary-700 transition-colors"
                >
                  Reports
                </Link>
                <Link
                  to="/profile"
                  className="text-primary-600 hover:text-primary-700 transition-colors"
                >
                  Profile
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-primary-600 hover:text-primary-700 transition-colors"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="text-primary-600 hover:text-primary-700 transition-colors"
                >
                  Sign Up
                </Link>
                <Link
                  to="/forgot-password"
                  className="text-primary-600 hover:text-primary-700 transition-colors"
                >
                  Reset Password
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Contact Support */}
        <div className="mt-8">
          <p className="text-xs text-secondary-400">
            Still having trouble?{' '}
            <a
              href="mailto:support@pfims.com"
              className="text-primary-600 hover:text-primary-700 transition-colors"
            >
              Contact Support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default NotFound;