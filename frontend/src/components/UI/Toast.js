import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import {
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { removeNotification } from '../../store/slices/uiSlice';

const Toast = () => {
  const dispatch = useDispatch();
  const { notifications } = useSelector((state) => state.ui);

  const getIcon = (type) => {
    switch (type) {
      case 'success':
        return CheckCircleIcon;
      case 'error':
        return XCircleIcon;
      case 'warning':
        return ExclamationTriangleIcon;
      case 'info':
        return InformationCircleIcon;
      default:
        return InformationCircleIcon;
    }
  };

  const getStyles = (type) => {
    switch (type) {
      case 'success':
        return {
          container: 'bg-success-50 border-success-200',
          icon: 'text-success-400',
          title: 'text-success-800',
          message: 'text-success-700',
          button: 'text-success-500 hover:text-success-600 focus:ring-success-600',
        };
      case 'error':
        return {
          container: 'bg-danger-50 border-danger-200',
          icon: 'text-danger-400',
          title: 'text-danger-800',
          message: 'text-danger-700',
          button: 'text-danger-500 hover:text-danger-600 focus:ring-danger-600',
        };
      case 'warning':
        return {
          container: 'bg-warning-50 border-warning-200',
          icon: 'text-warning-400',
          title: 'text-warning-800',
          message: 'text-warning-700',
          button: 'text-warning-500 hover:text-warning-600 focus:ring-warning-600',
        };
      case 'info':
        return {
          container: 'bg-primary-50 border-primary-200',
          icon: 'text-primary-400',
          title: 'text-primary-800',
          message: 'text-primary-700',
          button: 'text-primary-500 hover:text-primary-600 focus:ring-primary-600',
        };
      default:
        return {
          container: 'bg-secondary-50 border-secondary-200',
          icon: 'text-secondary-400',
          title: 'text-secondary-800',
          message: 'text-secondary-700',
          button: 'text-secondary-500 hover:text-secondary-600 focus:ring-secondary-600',
        };
    }
  };

  const handleDismiss = (id) => {
    dispatch(removeNotification(id));
  };

  // Auto-dismiss notifications
  useEffect(() => {
    const timers = notifications.map((notification) => {
      if (notification.duration && notification.duration > 0) {
        return setTimeout(() => {
          handleDismiss(notification.id);
        }, notification.duration);
      }
      return null;
    });

    return () => {
      timers.forEach((timer) => {
        if (timer) clearTimeout(timer);
      });
    };
  }, [notifications]);

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm w-full">
      <AnimatePresence>
        {notifications.map((notification) => {
          const Icon = getIcon(notification.type);
          const styles = getStyles(notification.type);

          return (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, x: 300, scale: 0.3 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 300, scale: 0.5, transition: { duration: 0.2 } }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className={clsx(
                'relative rounded-lg border p-4 shadow-lg backdrop-blur-sm',
                styles.container
              )}
            >
              <div className="flex">
                <div className="flex-shrink-0">
                  <Icon className={clsx('h-5 w-5', styles.icon)} />
                </div>
                <div className="ml-3 flex-1">
                  {notification.title && (
                    <h3 className={clsx('text-sm font-medium', styles.title)}>
                      {notification.title}
                    </h3>
                  )}
                  <div className={clsx('text-sm', styles.message, notification.title && 'mt-1')}>
                    {notification.message}
                  </div>
                  {notification.action && (
                    <div className="mt-3">
                      <button
                        onClick={notification.action.onClick}
                        className={clsx(
                          'text-sm font-medium underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-offset-2 rounded',
                          styles.button
                        )}
                      >
                        {notification.action.label}
                      </button>
                    </div>
                  )}
                </div>
                <div className="ml-4 flex-shrink-0 flex">
                  <button
                    onClick={() => handleDismiss(notification.id)}
                    className={clsx(
                      'inline-flex rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2',
                      styles.button
                    )}
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export default Toast;