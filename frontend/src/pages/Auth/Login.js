import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Eye, EyeOff } from 'lucide-react';
import { requestOtp, verifyOtp, resendVerificationEmail } from '../../store/slices/authSlice';
import { InlineSpinner } from '../../components/ui/LoadingSpinner';
import BrutalistScreen from '../../components/layout/BrutalistScreen';
import BrutalCard from '../../components/ui/BrutalCard';

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
    <BrutalistScreen>
      <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          {/* Header — bold brutalist title block */}
          <div className="text-left">
            <div className="inline-flex items-center gap-2 bg-brutal-ink text-brutal-paper px-3 py-1.5 mb-4">
              <span className="h-2 w-2 bg-brutal-accent" />
              <span className="text-[11px] font-bold uppercase tracking-[0.18em]">PFIMS · Auth</span>
            </div>
            <h1 className="font-display text-5xl font-extrabold leading-[0.95] tracking-tight text-brutal-ink">
              Sign in<span className="text-brutal-accent">.</span>
            </h1>
            <p className="mt-3 text-sm text-brutal-ink/70 max-w-xs">
              Two-factor by default. OTP goes to your inbox.
            </p>
          </div>

          {/* Form */}
          <form
            className="space-y-5"
            onSubmit={handleFormSubmit}
          >
            {error && (
              <div className="border-2 border-brutal-ink bg-rose-100 px-4 py-3">
                <p className="text-sm font-semibold text-brutal-ink">{error}</p>
              </div>
            )}

            {requiresVerification && (
              <div className="border-2 border-brutal-ink bg-amber-100 px-4 py-3 space-y-2">
                <p className="text-sm font-semibold text-brutal-ink">
                  Please verify your email before logging in.
                </p>
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={resendLoading || resendCooldown > 0}
                  className="text-xs font-bold uppercase tracking-wide underline underline-offset-2 text-brutal-ink disabled:opacity-50"
                >
                  {resendLoading
                    ? 'Sending…'
                    : resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : 'Resend verification email'}
                </button>
              </div>
            )}

            <BrutalCard className="p-6 sm:p-7 space-y-4">
              {step === 'credentials' ? (
                <>
                  <div>
                    <label htmlFor="email" className="block text-[11px] font-bold uppercase tracking-[0.14em] text-brutal-ink mb-1.5">
                      Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      {...emailRegister}
                      className="block w-full border-2 border-brutal-ink bg-brutal-paper px-3.5 py-3 text-sm font-medium text-brutal-ink placeholder:text-brutal-ink/40 focus:outline-none focus:bg-amber-50 transition-colors"
                      placeholder="you@example.com"
                    />
                    {errors.email && (
                      <p className="mt-1 text-xs font-semibold text-brutal-accent">
                        {errors.email.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="password" className="block text-[11px] font-bold uppercase tracking-[0.14em] text-brutal-ink mb-1.5">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        {...register('password')}
                        className="block w-full border-2 border-brutal-ink bg-brutal-paper px-3.5 py-3 pr-12 text-sm font-medium text-brutal-ink placeholder:text-brutal-ink/40 focus:outline-none focus:bg-amber-50 transition-colors"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 flex items-center px-3 text-brutal-ink/60 hover:text-brutal-ink"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="mt-1 text-xs font-semibold text-brutal-accent">
                        {errors.password.message}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <span className="relative inline-block">
                        <input
                          type="checkbox"
                          className="peer absolute opacity-0 w-5 h-5"
                        />
                        <span className="block w-5 h-5 border-2 border-brutal-ink peer-checked:bg-brutal-ink transition-colors" />
                      </span>
                      <span className="text-sm font-medium text-brutal-ink">Remember this device</span>
                    </label>
                    <Link to="/forgot-password" className="text-xs font-bold uppercase tracking-wide text-brutal-ink underline underline-offset-2 decoration-2 decoration-brutal-accent hover:decoration-brutal-ink">
                      Forgot?
                    </Link>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full inline-flex items-center justify-center gap-2 bg-brutal-ink text-brutal-paper border-2 border-brutal-ink px-4 py-3.5 text-sm font-bold uppercase tracking-[0.14em] shadow-[4px_4px_0_0_#0a0a0a] hover:shadow-[2px_2px_0_0_#0a0a0a] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <>
                        <InlineSpinner size="sm" color="white" className="mr-1" />
                        Sending OTP…
                      </>
                    ) : (
                      <>Send OTP →</>
                    )}
                  </button>
                </>
              ) : (
                <>
                  <div className="border-l-4 border-brutal-ink pl-3 mb-2">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brutal-ink/70">Code sent to</p>
                    <p className="text-sm font-bold text-brutal-ink break-all">{emailValue || 'your inbox'}</p>
                  </div>
                  <div>
                    <label htmlFor="otp" className="block text-[11px] font-bold uppercase tracking-[0.14em] text-brutal-ink mb-1.5">
                      6-digit code
                    </label>
                    <input
                      id="otp"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      autoComplete="one-time-code"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      className="block w-full border-2 border-brutal-ink bg-brutal-paper px-3.5 py-4 text-center text-3xl font-bold tracking-[0.4em] text-brutal-ink placeholder:text-brutal-ink/30 focus:outline-none focus:bg-amber-50 transition-colors"
                      placeholder="000000"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || otpCode.length < 4}
                    className="w-full inline-flex items-center justify-center gap-2 bg-brutal-ink text-brutal-paper border-2 border-brutal-ink px-4 py-3.5 text-sm font-bold uppercase tracking-[0.14em] shadow-[4px_4px_0_0_#0a0a0a] hover:shadow-[2px_2px_0_0_#0a0a0a] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <>
                        <InlineSpinner size="sm" color="white" className="mr-1" />
                        Verifying…
                      </>
                    ) : (
                      <>Verify & sign in →</>
                    )}
                  </button>

                  <div className="flex items-center justify-between pt-1 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setStep('credentials');
                        setOtpCode('');
                      }}
                      className="font-bold uppercase tracking-wide text-brutal-ink/70 hover:text-brutal-ink underline underline-offset-2"
                    >
                      ← Change email/password
                    </button>
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={resendCooldown > 0}
                      className="font-bold uppercase tracking-wide text-brutal-ink underline underline-offset-2 decoration-2 decoration-brutal-accent disabled:opacity-50 disabled:no-underline"
                    >
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
                    </button>
                  </div>
                </>
              )}
            </BrutalCard>

            <div className="text-center text-sm text-brutal-ink/80">
              No account?{' '}
              <Link to="/register" className="font-bold underline underline-offset-2 decoration-2 decoration-brutal-accent hover:text-brutal-ink">
                Sign up
              </Link>
            </div>
          </form>

          <div className="flex items-center gap-2 pt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-brutal-ink/50">
            <span className="h-1.5 w-1.5 bg-emerald-700" />
            <span>AES-256</span>
            <span className="h-3 w-px bg-brutal-ink/30" />
            <span>MFA-ready</span>
            <span className="h-3 w-px bg-brutal-ink/30" />
            <span>PFIMS v2</span>
          </div>
        </div>
      </div>
    </BrutalistScreen>
  );
};

export default Login;