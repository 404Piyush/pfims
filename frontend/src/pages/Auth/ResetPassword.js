import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useDispatch, useSelector } from 'react-redux';
import { resetPassword } from '../../store/slices/authSlice';
import {
  ArrowLeftIcon,
  EyeIcon,
  EyeSlashIcon,
  LockClosedIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import AuroraScreen from '../../components/layout/AuroraScreen';

const schema = yup.object({
  password: yup
    .string()
    .min(8, 'Password must be at least 8 characters')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain uppercase, lowercase, number and special character'
    )
    .required('Create a new password'),
  confirmPassword: yup
    .string()
    .oneOf([yup.ref('password')], 'Passwords must match')
    .required('Please confirm your password'),
});

const ResetPassword = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loading } = useSelector((state) => state.auth);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const token = searchParams.get('token');

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm({
    resolver: yupResolver(schema),
  });

  const password = watch('password');

  const passwordStrength = (() => {
    if (!password) return { score: 0, label: '' };
    let score = 0;
    if (password.length >= 8) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[@$!%*?&]/.test(password)) score++;
    let label = 'Weak';
    if (score === 3) label = 'Fair';
    else if (score === 4) label = 'Good';
    else if (score === 5) label = 'Strong';
    return { score, label };
  })();

  const onSubmit = async (data) => {
    if (!token) return;
    try {
      await dispatch(resetPassword({ token, password: data.password })).unwrap();
      navigate('/login', {
        state: { message: 'Password reset successfully. Please log in with your new password.' },
      });
    } catch (error) {
      // Error handled by slice
    }
  };

  if (!token) {
    return (
      <AuroraScreen>
        <div className="aurora-shell min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-md w-full">
            <div className="relative rounded-3xl border border-white/10 bg-black/40 backdrop-blur-2xl backdrop-saturate-150 shadow-[0_20px_80px_-20px_rgba(0,0,0,0.7)] p-8 text-center">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-rose-500/30 to-brand-pink/30 ring-1 ring-rose-300/40">
                <XCircleIcon className="h-8 w-8 text-rose-200" />
              </div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-white via-rose-200 to-brand-pink bg-clip-text text-transparent mb-2">
                Invalid reset link
              </h2>
              <p className="text-white/70 mb-6">
                This password reset link is invalid or has expired. Please request a new one.
              </p>
              <Link to="/forgot-password" className="btn-primary block w-full">
                Request new reset link
              </Link>
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
            <h2 className="text-3xl font-bold bg-gradient-to-r from-white via-brand-indigo to-white bg-clip-text text-transparent mb-2">
              Reset your password
            </h2>
            <p className="text-white/70 mb-8">
              Enter your new password below to regain access to your account.
            </p>

            <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
              <div>
                <label htmlFor="password" className="form-label">
                  New password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <LockClosedIcon className="h-5 w-5 text-white/40" />
                  </div>
                  <input
                    id="password"
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    className={`input pl-10 pr-12 ${errors.password ? 'input-error' : ''}`}
                    placeholder="At least 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={`absolute inset-y-0 right-0 pr-3 flex items-center transition-colors ${
                      showPassword ? 'text-white/85' : 'text-white/50 hover:text-white/85'
                    }`}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                  </button>
                </div>
                {password && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs text-white/60">
                      <span>Strength</span>
                      <span
                        className={
                          passwordStrength.score <= 2
                            ? 'text-rose-300'
                            : passwordStrength.score === 3
                            ? 'text-amber-300'
                            : passwordStrength.score === 4
                            ? 'text-cyan-300'
                            : 'text-emerald-300'
                        }
                      >
                        {passwordStrength.label}
                      </span>
                    </div>
                    <div className="mt-1 h-1 w-full rounded-full bg-white/10 overflow-hidden">
                      <div
                        className={
                          passwordStrength.score <= 2
                            ? 'h-full bg-rose-400'
                            : passwordStrength.score === 3
                            ? 'h-full bg-amber-400'
                            : passwordStrength.score === 4
                            ? 'h-full bg-cyan-400'
                            : 'h-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-brand-pink'
                        }
                        style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
                {errors.password && (
                  <p className="form-error">{errors.password.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="form-label">
                  Confirm new password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <LockClosedIcon className="h-5 w-5 text-white/40" />
                  </div>
                  <input
                    id="confirmPassword"
                    {...register('confirmPassword')}
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    className={`input pl-10 pr-12 ${errors.confirmPassword ? 'input-error' : ''}`}
                    placeholder="Repeat your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className={`absolute inset-y-0 right-0 pr-3 flex items-center transition-colors ${
                      showConfirmPassword ? 'text-white/85' : 'text-white/50 hover:text-white/85'
                    }`}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="form-error">{errors.confirmPassword.message}</p>
                )}
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? <LoadingSpinner size="sm" /> : 'Reset password'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </AuroraScreen>
  );
};

export default ResetPassword;
