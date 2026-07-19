import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useDispatch, useSelector } from 'react-redux';
import { ArrowLeft, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import BrutalistScreen from '../../components/layout/BrutalistScreen';
import BrutalCard from '../../components/ui/BrutalCard';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { resetPassword } from '../../store/slices/authSlice';

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

const brutalBtn =
  'w-full inline-flex items-center justify-center gap-2 bg-brutal-ink text-brutal-paper border-2 border-brutal-ink px-4 py-3.5 text-sm font-bold uppercase tracking-[0.14em] shadow-[4px_4px_0_0_#0a0a0a] hover:shadow-[2px_2px_0_0_#0a0a0a] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all disabled:opacity-50 disabled:cursor-not-allowed';
const brutalInput =
  'block w-full border-2 border-brutal-ink bg-brutal-paper px-3 py-3 text-sm font-medium text-brutal-ink placeholder:text-brutal-ink/40 focus:outline-none focus:bg-amber-50';
const brutalLabel =
  'block text-[11px] font-bold uppercase tracking-[0.14em] text-brutal-ink mb-1.5';

const ResetPassword = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isLoading } = useSelector((state) => state.auth);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const token = searchParams.get('token');

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm({ resolver: yupResolver(schema) });

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

  const strengthColor = () => {
    if (passwordStrength.score <= 2) return 'bg-rose-500';
    if (passwordStrength.score === 3) return 'bg-amber-500';
    if (passwordStrength.score === 4) return 'bg-cyan-600';
    return 'bg-emerald-600';
  };

  const onSubmit = async (data) => {
    if (!token) return;
    try {
      await dispatch(resetPassword({ token, password: data.password })).unwrap();
      navigate('/login', {
        state: { message: 'Password reset successfully. Please log in with your new password.' },
      });
    } catch (_) {}
  };

  if (!token) {
    return (
      <BrutalistScreen>
        <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-md w-full space-y-6">
            <div className="text-left">
              <div className="inline-flex items-center gap-2 bg-brutal-ink text-brutal-paper px-3 py-1.5 mb-4">
                <span className="h-2 w-2 bg-brutal-accent" />
                <span className="text-[11px] font-bold uppercase tracking-[0.18em]">PFIMS · Bad link</span>
              </div>
              <h1 className="font-display text-5xl font-extrabold leading-[0.95] tracking-tight text-brutal-ink">
                Expired<span className="text-brutal-accent">.</span>
              </h1>
            </div>

            <BrutalCard className="p-6 sm:p-7 space-y-5">
              <div className="grid h-14 w-14 place-items-center border-2 border-brutal-ink bg-rose-100">
                <AlertTriangle size={26} strokeWidth={2.5} className="text-rose-700" />
              </div>
              <p className="text-base text-brutal-ink leading-relaxed">
                This password reset link is invalid or has expired. Please request a new one.
              </p>
              <Link to="/forgot-password" className={brutalBtn}>
                Request new reset link →
              </Link>
            </BrutalCard>
          </div>
        </div>
      </BrutalistScreen>
    );
  }

  return (
    <BrutalistScreen>
      <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-6">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-brutal-ink/70 hover:text-brutal-ink"
          >
            <ArrowLeft size={14} />
            Back to login
          </Link>

          <div className="text-left">
            <div className="inline-flex items-center gap-2 bg-brutal-ink text-brutal-paper px-3 py-1.5 mb-4">
              <span className="h-2 w-2 bg-brutal-accent" />
              <span className="text-[11px] font-bold uppercase tracking-[0.18em]">PFIMS · Reset</span>
            </div>
            <h1 className="font-display text-5xl font-extrabold leading-[0.95] tracking-tight text-brutal-ink">
              New password<span className="text-brutal-accent">.</span>
            </h1>
            <p className="mt-3 text-sm text-brutal-ink/70">
              Pick something you'll remember. Strength meter helps.
            </p>
          </div>

          <BrutalCard className="p-6 sm:p-7 space-y-5">
            <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
              <div>
                <label htmlFor="password" className={brutalLabel}>New password</label>
                <div className="relative">
                  <input id="password" {...register('password')} type={showPassword ? 'text' : 'password'} autoComplete="new-password" className={brutalInput + ' pr-10'} placeholder="At least 8 characters" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 flex items-center px-3 text-brutal-ink/60 hover:text-brutal-ink" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {password && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-brutal-ink/60">
                      <span>Strength</span>
                      <span>{passwordStrength.label}</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full bg-brutal-paper border border-brutal-ink overflow-hidden">
                      <div className={'h-full ' + strengthColor()} style={{ width: `${(passwordStrength.score / 5) * 100}%` }} />
                    </div>
                  </div>
                )}
                {errors.password && <p className="mt-1 text-xs font-semibold text-brutal-accent">{errors.password.message}</p>}
              </div>

              <div>
                <label htmlFor="confirmPassword" className={brutalLabel}>Confirm new password</label>
                <div className="relative">
                  <input id="confirmPassword" {...register('confirmPassword')} type={showConfirmPassword ? 'text' : 'password'} autoComplete="new-password" className={brutalInput + ' pr-10'} placeholder="Repeat your password" />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute inset-y-0 right-0 flex items-center px-3 text-brutal-ink/60 hover:text-brutal-ink" aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}>
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="mt-1 text-xs font-semibold text-brutal-accent">{errors.confirmPassword.message}</p>}
              </div>

              <button type="submit" disabled={isLoading} className={brutalBtn}>
                {isLoading ? (
                  <>
                    <LoadingSpinner size="sm" />
                    <span className="ml-2">Resetting…</span>
                  </>
                ) : (
                  <>Reset password →</>
                )}
              </button>
            </form>
          </BrutalCard>
        </div>
      </div>
    </BrutalistScreen>
  );
};

export default ResetPassword;