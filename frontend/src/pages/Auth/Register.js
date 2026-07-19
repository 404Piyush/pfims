import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { clsx } from 'clsx';
import { Eye, EyeOff, Check, X } from 'lucide-react';
import BrutalistScreen from '../../components/layout/BrutalistScreen';
import BrutalCard from '../../components/ui/BrutalCard';
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
    } catch (e) {}
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || !emailValue) return;
    try {
      await dispatch(requestOtp({ email: emailValue, purpose: 'register' })).unwrap();
      setResendCooldown(60);
    } catch (e) {}
  };

  useEffect(() => {
    let interval;
    if (resendCooldown > 0) {
      interval = setInterval(() => setResendCooldown((v) => v - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const getPasswordStrengthColor = () => {
    if (passwordStrength <= 2) return 'bg-rose-500';
    if (passwordStrength <= 3) return 'bg-amber-500';
    if (passwordStrength <= 4) return 'bg-cyan-600';
    return 'bg-emerald-600';
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

  const brutalBtn =
    'w-full inline-flex items-center justify-center gap-2 bg-brutal-ink text-brutal-paper border-2 border-brutal-ink px-4 py-3.5 text-sm font-bold uppercase tracking-[0.14em] shadow-[4px_4px_0_0_#0a0a0a] hover:shadow-[2px_2px_0_0_#0a0a0a] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all disabled:opacity-50 disabled:cursor-not-allowed';
  const brutalInput =
    'block w-full border-2 border-brutal-ink bg-brutal-paper px-3 py-2.5 text-sm font-medium text-brutal-ink placeholder:text-brutal-ink/40 focus:outline-none focus:bg-amber-50';
  const brutalLabel =
    'block text-[11px] font-bold uppercase tracking-[0.14em] text-brutal-ink mb-1.5';

  return (
    <BrutalistScreen>
      <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-left">
            <div className="inline-flex items-center gap-2 bg-brutal-ink text-brutal-paper px-3 py-1.5 mb-4">
              <span className="h-2 w-2 bg-brutal-accent" />
              <span className="text-[11px] font-bold uppercase tracking-[0.18em]">PFIMS · New account</span>
            </div>
            <h1 className="font-display text-5xl font-extrabold leading-[0.95] tracking-tight text-brutal-ink">
              {step === 'otp' ? <>Verify<span className="text-brutal-accent">.</span></> : <>Sign up<span className="text-brutal-accent">.</span></>}
            </h1>
            <p className="mt-3 text-sm text-brutal-ink/70">
              {step === 'otp'
                ? `Enter the OTP sent to ${emailValue || 'your email'}`
                : 'No credit card. Email-verified.'}
            </p>
          </div>

          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (step === 'form') {
                handleSubmit(onSubmit)(e);
              } else {
                handleVerifyOtp();
              }
            }}
          >
            {error && (
              <div className="border-2 border-brutal-ink bg-rose-100 px-4 py-3">
                <p className="text-sm font-semibold text-brutal-ink">{error}</p>
              </div>
            )}

            <BrutalCard className="p-6 sm:p-7 space-y-4">
              {step === 'form' ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="firstName" className={brutalLabel}>First</label>
                      <input id="firstName" {...register('firstName')} type="text" autoComplete="given-name" className={brutalInput} placeholder="Pi" />
                      {errors.firstName && <p className="mt-1 text-xs font-semibold text-brutal-accent">{errors.firstName.message}</p>}
                    </div>
                    <div>
                      <label htmlFor="lastName" className={brutalLabel}>Last</label>
                      <input id="lastName" {...register('lastName')} type="text" autoComplete="family-name" className={brutalInput} placeholder="Yush" />
                      {errors.lastName && <p className="mt-1 text-xs font-semibold text-brutal-accent">{errors.lastName.message}</p>}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="email" className={brutalLabel}>Email</label>
                    <input id="email" {...register('email')} type="email" autoComplete="email" className={brutalInput} placeholder="you@example.com" />
                    {errors.email && <p className="mt-1 text-xs font-semibold text-brutal-accent">{errors.email.message}</p>}
                  </div>

                  <div>
                    <label htmlFor="password" className={brutalLabel}>Password</label>
                    <div className="relative">
                      <input id="password" {...register('password')} type={showPassword ? 'text' : 'password'} autoComplete="new-password" className={clsx(brutalInput, 'pr-10')} placeholder="••••••••" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 flex items-center px-3 text-brutal-ink/60 hover:text-brutal-ink" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {errors.password && <p className="mt-1 text-xs font-semibold text-brutal-accent">{errors.password.message}</p>}

                    {watchPassword && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-brutal-ink/60">Strength</span>
                          <span className="text-xs font-bold text-brutal-ink">{getPasswordStrengthText()}</span>
                        </div>
                        <div className="w-full bg-brutal-paper border border-brutal-ink h-1.5">
                          <div className={clsx('h-full transition-all duration-300', getPasswordStrengthColor())} style={{ width: `${(passwordStrength / 5) * 100}%` }} />
                        </div>
                      </div>
                    )}

                    {watchPassword && (
                      <div className="mt-3 grid grid-cols-1 gap-1">
                        {passwordRequirements.map((req, index) => (
                          <div key={index} className="flex items-center text-xs">
                            {req.met ? (
                              <Check size={14} className="text-emerald-700 mr-2" strokeWidth={3} />
                            ) : (
                              <X size={14} className="text-brutal-ink/30 mr-2" strokeWidth={3} />
                            )}
                            <span className={req.met ? 'text-brutal-ink font-semibold' : 'text-brutal-ink/50'}>
                              {req.text}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label htmlFor="confirmPassword" className={brutalLabel}>Confirm password</label>
                    <div className="relative">
                      <input id="confirmPassword" {...register('confirmPassword')} type={showConfirmPassword ? 'text' : 'password'} autoComplete="new-password" className={clsx(brutalInput, 'pr-10')} placeholder="••••••••" />
                      <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute inset-y-0 right-0 flex items-center px-3 text-brutal-ink/60 hover:text-brutal-ink" aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}>
                        {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {errors.confirmPassword && <p className="mt-1 text-xs font-semibold text-brutal-accent">{errors.confirmPassword.message}</p>}
                  </div>

                  <div className="flex items-start gap-2.5 pt-1">
                    <span className="relative inline-block mt-0.5">
                      <input id="acceptTerms" {...register('acceptTerms')} type="checkbox" className="peer absolute opacity-0 w-5 h-5" />
                      <span className="block w-5 h-5 border-2 border-brutal-ink peer-checked:bg-brutal-ink transition-colors" />
                    </span>
                    <label htmlFor="acceptTerms" className="text-sm text-brutal-ink/80 leading-snug">
                      I agree to the{' '}
                      <Link to="/terms" className="font-bold underline underline-offset-2 decoration-2 decoration-brutal-accent">Terms</Link>{' '}
                      and{' '}
                      <Link to="/privacy" className="font-bold underline underline-offset-2 decoration-2 decoration-brutal-accent">Privacy</Link>.
                    </label>
                  </div>
                  {errors.acceptTerms && <p className="text-xs font-semibold text-brutal-accent">{errors.acceptTerms.message}</p>}
                </>
              ) : (
                <>
                  <div className="border-l-4 border-brutal-ink pl-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brutal-ink/70">Code sent to</p>
                    <p className="text-sm font-bold text-brutal-ink break-all">{emailValue || 'your inbox'}</p>
                  </div>
                  <div>
                    <label htmlFor="otp" className={brutalLabel}>6-digit code</label>
                    <input id="otp" type="text" inputMode="numeric" maxLength={6} autoComplete="one-time-code" value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))} className="block w-full border-2 border-brutal-ink bg-brutal-paper px-3 py-4 text-center text-3xl font-bold tracking-[0.4em] text-brutal-ink placeholder:text-brutal-ink/30 focus:outline-none focus:bg-amber-50" placeholder="000000" />
                  </div>

                  <div className="flex items-center justify-between pt-1 text-xs">
                    <button type="button" onClick={() => { setStep('form'); setOtpCode(''); }} className="font-bold uppercase tracking-wide text-brutal-ink/70 hover:text-brutal-ink underline underline-offset-2">
                      ← Edit details
                    </button>
                    <button type="button" onClick={handleResendOtp} disabled={resendCooldown > 0} className="font-bold uppercase tracking-wide text-brutal-ink underline underline-offset-2 decoration-2 decoration-brutal-accent disabled:opacity-50 disabled:no-underline">
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
                    </button>
                  </div>
                </>
              )}
            </BrutalCard>

            <button
              type="submit"
              disabled={step === 'form' ? isLoading || !isValid : isLoading || otpCode.length < 4}
              className={brutalBtn}
            >
              {isLoading ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span className="ml-2">{step === 'form' ? 'Creating…' : 'Verifying…'}</span>
                </>
              ) : (
                <>{step === 'form' ? 'Create account' : 'Verify OTP'} →</>
              )}
            </button>

            <div className="text-center text-sm text-brutal-ink/80">
              Have an account?{' '}
              <Link to="/login" className="font-bold underline underline-offset-2 decoration-2 decoration-brutal-accent hover:text-brutal-ink">
                Sign in
              </Link>
            </div>
          </form>
        </div>
      </div>
    </BrutalistScreen>
  );
};

export default Register;