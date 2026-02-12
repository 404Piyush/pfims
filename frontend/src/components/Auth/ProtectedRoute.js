import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import LoadingSpinner from '../UI/LoadingSpinner';

const ProtectedRoute = ({ children, requireEmailVerification = false }) => {
  const { isAuthenticated, isBootstrapping, user } = useSelector((state) => state.auth);
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (isBootstrapping) {
    return <LoadingSpinner fullScreen text="Checking authentication..." />;
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check email verification if required
  if (requireEmailVerification && user && !user.isEmailVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
          <div className="mb-4">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-warning-100">
              <svg
                className="h-6 w-6 text-warning-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
          </div>
          <h3 className="text-lg font-medium text-secondary-900 mb-2">
            Email Verification Required
          </h3>
          <p className="text-sm text-secondary-600 mb-4">
            Please verify your email address to access this feature. Check your inbox for a verification link.
          </p>
          <button
            onClick={() => {
              // Dispatch resend verification email action
              // This would be implemented in the auth slice
            }}
            className="btn-primary"
          >
            Resend Verification Email
          </button>
        </div>
      </div>
    );
  }

  // Render protected content
  return children;
};

export default ProtectedRoute;
