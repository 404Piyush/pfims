import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { clsx } from 'clsx';
import AuroraScreen from '../../components/layout/AuroraScreen';
import AuroraCard from '../../components/ui/AuroraCard';
import {
  EyeIcon,
  EyeSlashIcon,
  CheckCircleIcon,
  XCircleIcon,
  UserIcon,
  EnvelopeIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';
import { register as registerUser, requestOtp, verifyOtp } from '../../store/slices/authSlice';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

const schema = yup.object({
  firstName: yup
    .string()
    .required('Enter your first name')
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name must be less than 50 characters'),
  lastName: yup
    .string()
    .required('Enter your last name')
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name must be less than 50 characters'),
  email: yup
    .string()
    .required('Enter your email address')
    .email('Please enter a valid email address'),
  password: yup
    .string()
    .required('Create a password')
    .min(8, 'Password must be at least 8 characters')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain uppercase, lowercase, number and special character'
    ),
  confirmPassword: yup
    .string()
    .required('Please confirm your password')
    .oneOf([yup.ref('password')], 'Passwords must match'),
  acceptTerms: yup
    .boolean()
    .oneOf([true], 'You must accept the terms and conditions'),
});

const Register = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isLoading, error } = useSelector((state) => state.auth);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [step, setStep] = useState('form');
  const [otpCode, setOtpCode] = useState('');
  const [emailValue, setEmailValue] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid },
  } = useForm({
    resolver: yupResolver(schema),
    mode: 'onChange',
  });

  const watchPassword = watch('password', '');

  // Calculate password strength
  useEffect(() => {
    const calculateStrength = (password) => {
      let strength = 0;
      if (password.length >= 8) strength += 1;
      if (/[a-z]/.test(password)) strength += 1;
      if (/[A-Z]/.test(password)) strength += 1;
      if (/\d/.test(password)) strength += 1;
      if (/[@$!%*?&]/.test(password)) strength += 1;
      return strength;
    };

    setPasswordStrength(calculateStrength(watchPassword));
  }, [watchPassword]);

  const onSubmit = async (data) => {
    try {
      await dispatch(registerUser({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
      })).unwrap();

      setEmailValue(data.email);
      setStep('otp');
      setResendCooldown(60);
    } catch (error) {
      console.error('Registration error:', error);
    }
  };

  const handleVerifyOtp = async () => {
    try {
      await dispatch(verifyOtp({ email: emailValue, purpose: 'register', code: otpCode })).unwrap();
      navigate('/onboarding/investment-profile');
    } catch (e) {
      // slice handles toast
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || !emailValue) return;
    try {
      await dispatch(requestOtp({ email: emailValue, purpose: 'register' })).unwrap();
      setResendCooldown(60);
    } catch (e) {
      // slice handles toast
    }
  };

  useEffect(() => {
    let interval;
    if (resendCooldown > 0) {
      interval = setInterval(() => setResendCooldown((v) => v - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const getPasswordStrengthColor = () => {
    if (passwordStrength <= 2) return 'bg-danger-500';
    if (passwordStrength <= 3) return 'bg-warning-500';
    if (passwordStrength <= 4) return 'bg-primary-500';
    return 'bg-success-500';
  };

  const getPasswordStrengthText = () => {
    if (passwordStrength <= 2) return 'Weak';
    if (passwordStrength <= 3) return 'Fair';
    if (passwordStrength <= 4) return 'Good';
    return 'Strong';
  };

  const passwordRequirements = [
    { text: 'At least 8 characters', met: watchPassword.length >= 8 },
    { text: 'One lowercase letter', met: /[a-z]/.test(watchPassword) },
    { text: 'One uppercase letter', met: /[A-Z]/.test(watchPassword) },
    { text: 'One number', met: /\d/.test(watchPassword) },
    { text: 'One special character', met: /[@$!%*?&]/.test(watchPassword) },
  ];

  return (
    <AuroraScreen>
      <div className="aurora-shell min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          {/* Header */}
          <div className="text-center">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-brand-indigo via-brand-cyan to-brand-pink flex items-center justify-center shadow-[0_18px_60px_-12px_rgba(99,102,241,0.6)]">
              <svg
                className="h-7 w-7 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                />
              </svg>
            </div>
            <h2 className="mt-6 text-3xl font-bold bg-gradient-to-r from-white via-brand-indigo to-white bg-clip-text text-transparent">
              {step === 'otp' ? 'Verify your email' : 'Create your account'}
            </h2>
            <p className="mt-2 text-sm text-white/70">
              {step === 'otp'
                ? `Enter the OTP sent to ${emailValue || 'your email'}`
                : 'Join PFIMS to take control of your finances'}
            </p>
          </div>

          {/* Card */}
          <form
            className="mt-8 space-y-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (step === 'form') {
                handleSubmit(onSubmit)(e);
              } else {
                handleVerifyOtp();
              }
            }}
          >
            <div className="relative rounded-3xl border border-white/10 bg-black/40 backdrop-blur-2xl backdrop-saturate-150 shadow-[0_20px_80px_-20px_rgba(0,0,0,0.7)] p-8">
              {/* Error message */}
              {error && (
                <div className="mb-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  <div className="flex">
                    <XCircleIcon className="h-5 w-5 text-rose-300" />
                    <p className="ml-3">{error}</p>
                  </div>
                </div>
              )}

              {step === 'form' ? (
                <div className="space-y-4">
                  {/* Name fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="firstName" className="form-label">
                        First name
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <UserIcon className="h-5 w-5 text-white/40" />
                        </div>
                        <input
                          {...register('firstName')}
                          type="text"
                          autoComplete="given-name"
                          className={clsx('input pl-10 pr-3', errors.firstName && 'input-error')}
                          placeholder="First name"
                        />
                      </div>
                      {errors.firstName && (
                        <p className="form-error">{errors.firstName.message}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="lastName" className="form-label">
                        Last name
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <UserIcon className="h-5 w-5 text-white/40" />
                        </div>
                        <input
                          {...register('lastName')}
                          type="text"
                          autoComplete="family-name"
                          className={clsx('input pl-10 pr-3', errors.lastName && 'input-error')}
                          placeholder="Last name"
                        />
                      </div>
                      {errors.lastName && (
                        <p className="form-error">{errors.lastName.message}</p>
                      )}
                    </div>
                  </div>

                  {/* Email field */}
                  <div>
                    <label htmlFor="email" className="form-label">
                      Email address
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <EnvelopeIcon className="h-5 w-5 text-white/40" />
                      </div>
                      <input
                        {...register('email')}
                        type="email"
                        autoComplete="email"
                        className={clsx('input pl-10 pr-3', errors.email && 'input-error')}
                        placeholder="you@example.com"
                      />
                    </div>
                    {errors.email && (
                      <p className="form-error">{errors.email.message}</p>
                    )}
                  </div>

                  {/* Password field */}
                  <div>
                    <label htmlFor="password" className="form-label">
                      Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <LockClosedIcon className="h-5 w-5 text-white/40" />
                      </div>
                      <input
                        {...register('password')}
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        className={clsx('input pl-10 pr-12', errors.password && 'input-error')}
                        placeholder="At least 8 characters"
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className={clsx(
                            'focus:outline-none transition-colors',
                            showPassword ? 'text-white/85' : 'text-white/50 hover:text-white/85'
                          )}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>
                    {errors.password && (
                      <p className="form-error">{errors.password.message}</p>
                    )}

                    {/* Password strength indicator */}
                    {watchPassword && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between mb-1 text-xs text-white/60">
                          <span>Password strength</span>
                          <span
                            className={clsx(
                              'font-medium',
                              passwordStrength <= 2 && 'text-rose-300',
                              passwordStrength === 3 && 'text-amber-300',
                              passwordStrength === 4 && 'text-cyan-300',
                              passwordStrength >= 5 && 'text-emerald-300'
                            )}
                          >
                            {getPasswordStrengthText()}
                          </span>
                        </div>
                        <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className={clsx(
                              'h-full rounded-full transition-all duration-300',
                              passwordStrength <= 2 && 'bg-rose-400',
                              passwordStrength === 3 && 'bg-amber-400',
                              passwordStrength === 4 && 'bg-cyan-400',
                              passwordStrength >= 5 && 'bg-gradient-to-r from-emerald-400 via-cyan-400 to-brand-pink'
                            )}
                            style={{ width: `${(passwordStrength / 5) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Password requirements */}
                    {watchPassword && (
                      <ul className="mt-3 space-y-1">
                        {passwordRequirements.map((req, index) => (
                          <li key={index} className="flex items-center text-xs">
                            {req.met ? (
                              <CheckCircleIcon className="h-3 w-3 text-emerald-300 mr-2" />
                            ) : (
                              <XCircleIcon className="h-3 w-3 text-white/40 mr-2" />
                            )}
                            <span className={req.met ? 'text-emerald-200' : 'text-white/55'}>
                              {req.text}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Confirm password field */}
                  <div>
                    <label htmlFor="confirmPassword" className="form-label">
                      Confirm password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <LockClosedIcon className="h-5 w-5 text-white/40" />
                      </div>
                      <input
                        {...register('confirmPassword')}
                        type={showConfirmPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        className={clsx('input pl-10 pr-12', errors.confirmPassword && 'input-error')}
                        placeholder="Repeat your password"
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className={clsx(
                            'focus:outline-none transition-colors',
                            showConfirmPassword ? 'text-white/85' : 'text-white/50 hover:text-white/85'
                          )}
                          aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                        >
                          {showConfirmPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>
                    {errors.confirmPassword && (
                      <p className="form-error">{errors.confirmPassword.message}</p>
                    )}
                  </div>

                  {/* Terms and conditions */}
                  <div className="flex items-start pt-2">
                    <div className="relative flex items-center h-5">
                      <input
                        {...register('acceptTerms')}
                        id="acceptTerms"
                        type="checkbox"
                        className="sr-only peer"
                      />
                      <label
                        htmlFor="acceptTerms"
                        className="h-5 w-5 rounded border border-white/30 bg-white/5 peer-checked:bg-gradient-to-br peer-checked:from-brand-indigo peer-checked:to-brand-pink peer-checked:border-transparent peer-focus-visible:ring-2 peer-focus-visible:ring-brand-indigo cursor-pointer transition-colors"
                      />
                    </div>
                    <label htmlFor="acceptTerms" className="ml-3 text-sm text-white/70 leading-5">
                      I agree to the{' '}
                      <Link to="/terms" className="text-brand-cyan hover:text-white font-medium underline-offset-2 hover:underline">
                        Terms and Conditions
                      </Link>{' '}
                      and{' '}
                      <Link to="/privacy" className="text-brand-cyan hover:text-white font-medium underline-offset-2 hover:underline">
                        Privacy Policy
                      </Link>
                    </label>
                  </div>
                  {errors.acceptTerms && (
                    <p className="form-error -mt-2">{errors.acceptTerms.message}</p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="otp" className="form-label">
                      Enter the 6-digit code
                    </label>
                    <input
                      id="otp"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="input tracking-[0.4em] text-center text-lg font-semibold"
                      placeholder="·  ·  ·  ·  ·  ·"
                    />
                    <p className="mt-2 text-xs text-white/55">
                      Sent to <span className="text-white/80">{emailValue}</span>. Codes expire in 10 minutes.
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <button
                      type="button"
                      onClick={() => {
                        setStep('form');
                        setOtpCode('');
                      }}
                      className="text-white/70 hover:text-white transition-colors"
                    >
                      ← Edit details
                    </button>
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={resendCooldown > 0}
                      className="font-medium text-brand-cyan hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
                    </button>
                  </div>
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={step === 'form' ? isLoading || !isValid : isLoading || otpCode.length !== 6}
                className="btn-primary mt-7 w-full"
              >
                {isLoading ? <LoadingSpinner size="sm" /> : step === 'form' ? 'Create Account' : 'Verify & Continue'}
              </button>
            </div>

            {/* Sign in link */}
            <div className="text-center">
              <p className="text-sm text-white/70">
                Already have an account?{' '}
                <Link to="/login" className="font-medium text-brand-cyan hover:text-white transition-colors">
                  Sign in
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </AuroraScreen>
  );
};

export default Register;
