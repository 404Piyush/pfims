import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { requestOtp, verifyOtp, resendVerificationEmail } from '../../store/slices/authSlice';
import { InlineSpinner } from '../../components/ui/LoadingSpinner';
import AuroraScreen from '../../components/layout/AuroraScreen';
import AuroraCard from '../../components/ui/AuroraCard';

const loginSchema = yup.object({
  email: yup
    .string()
    .email('Please enter a valid email address')
    .required('Enter your email address'),
  password: yup
    .string()
    .min(8, 'Password must be at least 8 characters')
    .required('Enter your password'),
});

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState('credentials');
  const [otpCode, setOtpCode] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [requiresVerification, setRequiresVerification] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoading, error } = useSelector((state) => state.auth);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: yupResolver(loginSchema) });
  const [emailValue, setEmailValue] = useState('');
  const emailRegister = register('email', {
    onChange: (e) => setEmailValue(e.target.value),
  });

  const onSubmitCredentials = async (data) => {
    try {
      setRequiresVerification(false);
      setEmailValue(data.email);
      setLoginPassword(data.password);
      setOtpCode('');
      setStep('otp');
      setResendCooldown(60);
      await dispatch(
        requestOtp({ email: data.email, password: data.password, purpose: 'login' })
      ).unwrap();
    } catch (err) {
      setStep('credentials');
      setResendCooldown(0);
      if (err?.requiresEmailVerification) setRequiresVerification(true);
    }
  };

  const handleVerifyOtp = async () => {
    try {
      await dispatch(
        verifyOtp({ email: emailValue, purpose: 'login', code: otpCode })
      ).unwrap();
      const from = location.state?.from?.pathname || '/';
      navigate(from, { replace: true });
    } catch (_) {}
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || !emailValue || !loginPassword) return;
    try {
      await dispatch(
        requestOtp({ email: emailValue, password: loginPassword, purpose: 'login' })
      ).unwrap();
      setResendCooldown(60);
    } catch (_) {}
  };

  const handleResendVerification = async () => {
    if (resendCooldown > 0 || !emailValue) return;
    setResendLoading(true);
    try {
      await dispatch(resendVerificationEmail(emailValue)).unwrap();
      setResendCooldown(60);
    } catch (_) {} finally {
      setResendLoading(false);
    }
  };

  React.useEffect(() => {
    let interval;
    if (resendCooldown > 0) {
      interval = setInterval(() => setResendCooldown((v) => v - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const handleFormSubmit =
    step === 'credentials'
      ? handleSubmit(onSubmitCredentials)
      : (e) => {
          e.preventDefault();
          handleVerifyOtp();
        };

  return (
    <AuroraScreen>
      <div className="aurora-shell min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          {/* Header */}
          <div className="text-center">
            <div className="mx-auto h-16 w-16 rounded-2xl overflow-hidden mb-5 ring-1 ring-white/15 shadow-[0_18px_60px_-12px_rgba(99,102,241,0.6)]">
              <img src="/logo.png" alt="PFIMS Logo" className="h-16 w-16 object-contain" />
            </div>
            <h2 className="text-4xl font-extrabold tracking-tight">
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    'linear-gradient(120deg, #ffffff 0%, #c7d2fe 35%, #a5f3fc 65%, #ffffff 100%)',
                }}
              >
                Welcome back to PFIMS
              </span>
            </h2>
            <p className="mt-3 text-sm text-white/60">
              Sign in to your account to manage your finances
            </p>
          </div>

          {/* Form Card */}
          <AuroraCard accent="indigo" className="p-8">
            <form className="space-y-5" onSubmit={handleFormSubmit}>
              {/* Email Field — only editable in credentials step */}
              <div className="form-group">
                <label htmlFor="email" className="form-label block text-sm font-medium mb-1.5">
                  Email address
                </label>
                <input
                  {...emailRegister}
                  type="email"
                  id="email"
                  className={`input w-full ${errors.email ? 'input-error' : ''}`}
                  placeholder="Enter your email"
                  autoComplete="email"
                  disabled={step === 'otp'}
                />
                {errors.email && <p className="form-error">{errors.email.message}</p>}
              </div>

              {/* Password Field */}
              {step === 'credentials' && (
                <div className="form-group">
                  <label htmlFor="password" className="form-label block text-sm font-medium mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      {...register('password')}
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      className={`input w-full pr-11 ${errors.password ? 'input-error' : ''}`}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-white/50 hover:text-white/85"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                    </button>
                  </div>
                  {errors.password && <p className="form-error">{errors.password.message}</p>}
                </div>
              )}

              {/* OTP Field — only when in OTP step */}
              {step === 'otp' && (
                <div className="form-group">
                  <label htmlFor="otp" className="form-label block text-sm font-medium mb-1.5">
                    Email OTP
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    id="otp"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    className="input w-full tracking-[0.4em] text-center text-lg font-semibold"
                    placeholder="Enter the 6-digit code"
                    autoComplete="one-time-code"
                    maxLength={6}
                  />
                  <p className="form-error !text-white/45 !mt-1">
                    Sent to <span className="text-white/75">{emailValue}</span>. Check your inbox.
                  </p>
                </div>
              )}

              {/* Remember Me & Forgot Password */}
              {step === 'credentials' && (
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      id="remember-me"
                      name="remember-me"
                      type="checkbox"
                      className="peer sr-only"
                    />
                    <span
                      aria-hidden
                      className="h-4 w-4 rounded border border-white/30 bg-white/5 peer-checked:bg-gradient-to-br peer-checked:from-brand-indigo peer-checked:to-brand-pink peer-checked:border-transparent peer-focus-visible:ring-2 peer-focus-visible:ring-brand-indigo/60 transition-colors"
                    />
                    <span className="text-sm text-white/75 hover:text-white">Remember me</span>
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-sm font-medium text-white/80 hover:text-white transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
              )}

              {/* Submit */}
              {step === 'credentials' ? (
                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-primary w-full flex items-center justify-center"
                >
                  {isLoading ? (
                    <>
                      <InlineSpinner size="sm" color="white" className="mr-2" />
                      Sending OTP…
                    </>
                  ) : (
                    'Send OTP'
                  )}
                </button>
              ) : (
                <div className="space-y-3">
                  <button
                    type="submit"
                    disabled={isLoading || !otpCode}
                    className="btn-primary w-full flex items-center justify-center"
                  >
                    {isLoading ? (
                      <>
                        <InlineSpinner size="sm" color="white" className="mr-2" />
                        Verifying…
                      </>
                    ) : (
                      'Verify & sign in'
                    )}
                  </button>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <button
                      type="button"
                      onClick={() => {
                        setStep('credentials');
                        setOtpCode('');
                      }}
                      className="font-medium text-white/60 hover:text-white transition-colors"
                    >
                      ← Change email/password
                    </button>
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={resendCooldown > 0}
                      className="font-medium text-white/80 hover:text-white transition-colors disabled:opacity-50"
                    >
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
                    </button>
                  </div>
                </div>
              )}

              {requiresVerification && (
                <div className="rounded-xl bg-white/[0.04] border border-amber-300/30 p-4 text-sm text-amber-100">
                  Your email isn't verified yet. We'll send a fresh verification link.
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={resendLoading || resendCooldown > 0 || !emailValue}
                    className="mt-3 w-full inline-flex justify-center items-center rounded-lg bg-gradient-to-br from-amber-400 to-rose-400 px-4 py-2 text-zinc-900 font-semibold disabled:opacity-50"
                  >
                    {resendLoading
                      ? 'Sending…'
                      : resendCooldown > 0
                      ? `Resend in ${resendCooldown}s`
                      : 'Send verification email'}
                  </button>
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-rose-300/30 bg-rose-500/10 p-3 text-sm text-rose-100">
                  {error}
                </div>
              )}
            </form>

            <div className="mt-6 pt-6 border-t border-white/10 text-center">
              <p className="text-sm text-white/60">
                Don't have an account?{' '}
                <Link
                  to="/register"
                  className="font-semibold text-white hover:underline underline-offset-4 decoration-brand-cyan/70"
                >
                  Sign up for free
                </Link>
              </p>
            </div>
          </AuroraCard>

          {/* Trust line */}
          <div className="text-center space-y-3 pt-1">
            <p className="text-xs text-white/45 tracking-wide">
              Trusted by users worldwide · SOC2-grade security
            </p>
            <div className="flex justify-center gap-5 text-[11px] text-white/55">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Encrypted
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand-cyan" />
                MFA-ready
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand-pink" />
                Fast
              </span>
            </div>
          </div>
        </div>
      </div>
    </AuroraScreen>
  );
};

export default Login;