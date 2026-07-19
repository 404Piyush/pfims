import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useDispatch, useSelector } from 'react-redux';
import { forgotPassword } from '../../store/slices/authSlice';
import { ArrowLeftIcon, EnvelopeIcon } from '@heroicons/react/24/outline';
import AuroraScreen from '../../components/layout/AuroraScreen';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

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
      // Error handled by slice
    }
  };

  if (isSubmitted) {
    return (
      <AuroraScreen>
        <div className="aurora-shell min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-md w-full">
            <div className="relative rounded-3xl border border-white/10 bg-black/40 backdrop-blur-2xl backdrop-saturate-150 shadow-[0_20px_80px_-20px_rgba(0,0,0,0.7)] p-8">
              <div className="text-center">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400/30 to-brand-cyan/30 ring-1 ring-emerald-300/40">
                  <EnvelopeIcon className="h-8 w-8 text-emerald-200" />
                </div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-white via-emerald-200 to-brand-cyan bg-clip-text text-transparent mb-2">
                  Check your email
                </h2>
                <p className="text-white/70 mb-6 leading-relaxed">
                  We've sent a password reset link to{' '}
                  <span className="font-medium text-white">{getValues('email')}</span>.<br />
                  The link expires in 1 hour.
                </p>
                <div className="space-y-3">
                  <Link to="/login" className="btn-primary block w-full">
                    Back to login
                  </Link>
                  <button
                    type="button"
                    onClick={() => setIsSubmitted(false)}
                    className="block w-full rounded-xl border border-white/15 bg-white/5 py-3 px-4 text-sm font-medium text-white/85 hover:bg-white/10 transition-colors"
                  >
                    Try a different email
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AuroraScreen>
    );
  }

  return (
    <AuroraScreen>
      <div className="aurora-shell min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          <div className="relative rounded-3xl border border-white/10 bg-black/40 backdrop-blur-2xl backdrop-saturate-150 shadow-[0_20px_80px_-20px_rgba(0,0,0,0.7)] p-8">
            <Link
              to="/login"
              className="inline-flex items-center text-sm text-white/70 hover:text-white mb-6 transition-colors"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Back to login
            </Link>

            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-cyan to-brand-pink shadow-[0_18px_60px_-12px_rgba(6,182,212,0.6)]">
              <EnvelopeIcon className="h-7 w-7 text-white" />
            </div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-white via-brand-cyan to-white bg-clip-text text-transparent mb-2">
              Forgot your password?
            </h2>
            <p className="text-white/70 mb-8 leading-relaxed">
              No worries — enter your email and we'll send you a link to reset your password.
            </p>

            <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
              <div>
                <label htmlFor="email" className="form-label">
                  Email address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <EnvelopeIcon className="h-5 w-5 text-white/40" />
                  </div>
                  <input
                    id="email"
                    {...register('email')}
                    type="email"
                    autoComplete="email"
                    className={`input pl-10 pr-3 ${errors.email ? 'input-error' : ''}`}
                    placeholder="you@example.com"
                  />
                </div>
                {errors.email && (
                  <p className="form-error">{errors.email.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full"
              >
                {loading ? <LoadingSpinner size="sm" /> : 'Send reset link'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-white/70">
                Remember your password?{' '}
                <Link to="/login" className="font-medium text-brand-cyan hover:text-white transition-colors">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </AuroraScreen>
  );
};

export default ForgotPassword;
