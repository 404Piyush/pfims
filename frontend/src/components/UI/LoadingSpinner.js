import React from 'react';
import { clsx } from 'clsx';

const LoadingSpinner = ({ 
  size = 'md', 
  color = 'primary', 
  className = '',
  text = '',
  fullScreen = false 
}) => {
  const sizeClasses = {
    xs: 'h-3 w-3',
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-12 w-12',
  };

  const colorClasses = {
    primary: 'text-primary-600',
    secondary: 'text-secondary-600',
    success: 'text-success-600',
    warning: 'text-warning-600',
    danger: 'text-danger-600',
    white: 'text-white',
  };

  const spinnerClasses = clsx(
    'animate-spin rounded-full border-2 border-solid border-current border-r-transparent',
    sizeClasses[size],
    colorClasses[color],
    className
  );

  const content = (
    <div className="flex flex-col items-center justify-center space-y-2">
      <div className={spinnerClasses} role="status" aria-label="Loading">
        <span className="sr-only">Loading...</span>
      </div>
      {text && (
        <p className={clsx(
          'text-sm font-medium',
          colorClasses[color] === 'text-white' ? 'text-white' : 'text-secondary-600'
        )}>
          {text}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
        {content}
      </div>
    );
  }

  return content;
};

// Inline spinner for buttons and small spaces
export const InlineSpinner = ({ size = 'sm', color = 'white', className = '' }) => {
  const sizeClasses = {
    xs: 'h-3 w-3',
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
  };

  const colorClasses = {
    primary: 'text-primary-600',
    secondary: 'text-secondary-600',
    white: 'text-white',
    current: 'text-current',
  };

  return (
    <div
      className={clsx(
        'animate-spin rounded-full border-2 border-solid border-current border-r-transparent',
        sizeClasses[size],
        colorClasses[color],
        className
      )}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
};

// Skeleton loader for content placeholders
export const SkeletonLoader = ({ 
  lines = 3, 
  className = '',
  avatar = false,
  button = false 
}) => {
  return (
    <div className={clsx('animate-pulse', className)}>
      {avatar && (
        <div className="flex items-center space-x-4 mb-4">
          <div className="h-10 w-10 bg-secondary-200 rounded-full"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-secondary-200 rounded w-1/4"></div>
            <div className="h-3 bg-secondary-200 rounded w-1/3"></div>
          </div>
        </div>
      )}
      
      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className={clsx(
              'h-4 bg-secondary-200 rounded',
              index === lines - 1 ? 'w-2/3' : 'w-full'
            )}
          ></div>
        ))}
      </div>

      {button && (
        <div className="mt-4">
          <div className="h-10 bg-secondary-200 rounded w-24"></div>
        </div>
      )}
    </div>
  );
};

// Loading overlay for forms and containers
export const LoadingOverlay = ({ isLoading, children, text = 'Loading...' }) => {
  return (
    <div className="relative">
      {children}
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 backdrop-blur-sm rounded-lg">
          <LoadingSpinner size="lg" text={text} />
        </div>
      )}
    </div>
  );
};

export default LoadingSpinner;