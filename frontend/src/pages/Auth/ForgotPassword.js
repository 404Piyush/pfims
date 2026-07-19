import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useDispatch, useSelector } from 'react-redux';
import { ArrowLeft, Check } from 'lucide-react';
import BrutalistScreen from '../../components/layout/BrutalistScreen';
import BrutalCard from '../../components/ui/BrutalCard';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { forgotPassword } from '../../store/slices/authSlice';

const schema = yup.object({
  email: yup
    .string()
    .email('Please enter a valid email address')
    .required('Enter your email address'),
});

const brutalBtn =
  'w-full inline-flex items-center justify-center gap-2 bg-brutal-ink text-brutal-paper border-2 border-brutal-ink px-4 py-3.5 text-sm font-bold uppercase tracking-[0.14em] shadow-[4px_4px_0_0_#0a0a0a] hover:shadow-[2px_2px_0_0_#0a0a0a] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all disabled:opacity-50 disabled:cursor-not-allowed';
const brutalBtnSecondary =
  'w-full inline-flex items-center justify-center gap-2 bg-brutal-paper text-brutal-ink border-2 border-brutal-ink px-4 py-3.5 text-sm font-bold uppercase tracking-[0.14em] shadow-[4px_4px_0_0_#0a0a0a] hover:shadow-[2px_2px_0_0_#0a0a0a] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all';
const brutalInput =
  'block w-full border-2 border-brutal-ink bg-brutal-paper px-3 py-3 text-sm font-medium text-brutal-ink placeholder:text-brutal-ink/40 focus:outline-none focus:bg-amber-50';
const brutalLabel =
  'block text-[11px] font-bold uppercase tracking-[0.14em] text-brutal-ink mb-1.5';

const ForgotPassword = () => {
  const dispatch = useDispatch();
  const { isLoading } = useSelector((state) => state.auth);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(schema),
  });

  const onSubmit = async (data) => {
    try {
      await dispatch(forgotPassword(data.email)).unwrap();
      setSubmittedEmail(data.email);
      setIsSubmitted(true);
    } catch (_) {}
  };

  if (isSubmitted) {
    return (
      <BrutalistScreen>
        <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-md w-full space-y-6">
            <div className="text-left">
              <div className="inline-flex items-center gap-2 bg-brutal-ink text-brutal-paper px-3 py-1.5 mb-4">
                <span className="h-2 w-2 bg-brutal-accent" />
                <span className="text-[11px] font-bold uppercase tracking-[0.18em]">PFIMS · Reset link sent</span>
              </div>
              <h1 className="font-display text-5xl font-extrabold leading-[0.95] tracking-tight text-brutal-ink">
                Check<span className="text-brutal-accent">.</span>
              </h1>
            </div>

            <BrutalCard className="p-6 sm:p-7 space-y-5">
              <div className="grid h-14 w-14 place-items-center border-2 border-brutal-ink bg-emerald-100">
                <Check size={26} strokeWidth={3} className="text-emerald-800" />
              </div>
              <p className="text-base text-brutal-ink leading-relaxed">
                We've sent a password reset link to{' '}
                <span className="font-bold break-all underline decoration-2 decoration-brutal-accent">{submittedEmail}</span>.
                The link expires in 1 hour.
              </p>
              <div className="space-y-3">
                <Link to="/login" className={brutalBtn}>
                  Back to login →
                </Link>
                <button
                  type="button"
                  onClick={() => setIsSubmitted(false)}
                  className={brutalBtnSecondary}
                >
                  Try a different email
                </button>
              </div>
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
              Forgot<span className="text-brutal-accent">?</span>
            </h1>
            <p className="mt-3 text-sm text-brutal-ink/70">
              Enter your email and we'll send a reset link.
            </p>
          </div>

          <BrutalCard className="p-6 sm:p-7 space-y-5">
            <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
              <div>
                <label htmlFor="email" className={brutalLabel}>Email address</label>
                <input
                  id="email"
                  {...register('email')}
                  type="email"
                  autoComplete="email"
                  className={brutalInput}
                  placeholder="you@example.com"
                />
                {errors.email && (
                  <p className="mt-1 text-xs font-semibold text-brutal-accent">{errors.email.message}</p>
                )}
              </div>

              <button type="submit" disabled={isLoading} className={brutalBtn}>
                {isLoading ? (
                  <>
                    <LoadingSpinner size="sm" />
                    <span className="ml-2">Sending…</span>
                  </>
                ) : (
                  <>Send reset link →</>
                )}
              </button>
            </form>

            <div className="text-center text-sm text-brutal-ink/80 pt-1">
              Remember your password?{' '}
              <Link to="/login" className="font-bold underline underline-offset-2 decoration-2 decoration-brutal-accent hover:text-brutal-ink">
                Sign in
              </Link>
            </div>
          </BrutalCard>
        </div>
      </div>
    </BrutalistScreen>
  );
};

export default ForgotPassword;