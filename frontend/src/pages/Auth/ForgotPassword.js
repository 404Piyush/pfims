import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useDispatch, useSelector } from 'react-redux';
import { forgotPassword } from '../../store/slices/authSlice';
import { ArrowLeftIcon, EnvelopeIcon } from '@heroicons/react/24/outline';
import LoadingSpinner from '../../components/UI/LoadingSpinner';

const schema = yup.object({
  email: yup
    .string()
    .email('Please enter a valid email address')
    .required('Enter your email address'),
});

const ForgotPassword = () => {
  const dispatch = useDispatch();
  const { loading } = useSelector((state) => state.auth);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
  } = useForm({
    resolver: yupResolver(schema),
  });

  const onSubmit = async (data) => {
    try {
      await dispatch(forgotPassword(data.email)).unwrap();
      setIsSubmitted(true);
    } catch (error) {
      // Error is handled by the slice
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-success-100 mb-6">
                <EnvelopeIcon className="h-8 w-8 text-success-600" />
              </div>
              <h2 className="text-2xl font-bold text-secondary-900 mb-2">
                Check your email
              </h2>
              <p className="text-secondary-600 mb-6">
                We've sent a password reset link to{' '}
                <span className="font-medium text-secondary-900">
                  {getValues('email')}
                </span>
              </p>
              <div className="space-y-4">
                <Link
                  to="/login"
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
                >
                  Back to login
                </Link>
                <button
                  onClick={() => setIsSubmitted(false)}
                  className="w-full flex justify-center py-3 px-4 border border-secondary-300 rounded-lg shadow-sm text-sm font-medium text-secondary-700 bg-white hover:bg-secondary-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
                >
                  Try different email
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center">
            <Link
              to="/login"
              className="inline-flex items-center text-sm text-secondary-600 hover:text-secondary-900 mb-6 transition-colors"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Back to login
            </Link>
            <h2 className="text-3xl font-bold text-secondary-900 mb-2">
              Forgot your password?
            </h2>
            <p className="text-secondary-600 mb-8">
              No worries! Enter your email address and we'll send you a link to reset your password.
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-secondary-700 mb-2">
                Email address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <EnvelopeIcon className="h-5 w-5 text-secondary-400" />
                </div>
                <input
                  {...register('email')}
                  type="email"
                  autoComplete="email"
                  className={`block w-full pl-10 pr-3 py-3 border rounded-lg shadow-sm placeholder-secondary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm transition-colors ${
                    errors.email
                      ? 'border-danger-300 focus:ring-danger-500 focus:border-danger-500'
                      : 'border-secondary-300'
                  }`}
                  placeholder="Enter your email"
                />
              </div>
              {errors.email && (
                <p className="mt-2 text-sm text-danger-600">{errors.email.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <LoadingSpinner size="sm" color="white" />
              ) : (
                'Send reset link'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-secondary-600">
              Remember your password?{' '}
              <Link
                to="/login"
                className="font-medium text-primary-600 hover:text-primary-500 transition-colors"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
