import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import LoadingSpinner from '../ui/LoadingSpinner';

const PublicRoute = ({ children }) => {
  const { isAuthenticated, isBootstrapping } = useSelector((state) => state.auth);
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (isBootstrapping) {
    return <LoadingSpinner fullScreen text="Loading..." />;
  }

  // Redirect to dashboard if already authenticated
  if (isAuthenticated) {
    const from = location.state?.from?.pathname || '/';
    return <Navigate to={from} replace />;
  }

  // Render public content (login, register, etc.)
  return children;
};

export default PublicRoute;
