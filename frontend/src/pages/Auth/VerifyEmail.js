import React, { useEffect, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  ShieldCheck,
  MailCheck,
  AlertTriangle,
  Loader2,
  Mail,
  RefreshCw,
  ArrowLeft,
} from 'lucide-react';
import { verifyEmail, resendVerificationEmail } from '../../store/slices/authSlice';
import BrutalistScreen from '../../components/layout/BrutalistScreen';
import BrutalCard from '../../components/ui/BrutalCard';

const brutalBtn =
  'w-full inline-flex items-center justify-center gap-2 bg-brutal-ink text-brutal-paper border-2 border-brutal-ink px-4 py-3.5 text-sm font-bold uppercase tracking-[0.14em] shadow-[4px_4px_0_0_#0a0a0a] hover:shadow-[2px_2px_0_0_#0a0a0a] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all disabled:opacity-50 disabled:cursor-not-allowed';
const brutalBtnSecondary =
  'w-full inline-flex items-center justify-center gap-2 bg-brutal-paper text-brutal-ink border-2 border-brutal-ink px-4 py-3.5 text-sm font-bold uppercase tracking-[0.14em] shadow-[4px_4px_0_0_#0a0a0a] hover:shadow-[2px_2px_0_0_#0a0a0a] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all';
const brutalInput =
  'block w-full border-2 border-brutal-ink bg-brutal-paper px-3 py-2.5 text-sm font-medium text-brutal-ink placeholder:text-brutal-ink/40 focus:outline-none focus:bg-amber-50';
const brutalLabel =
  'block text-[11px] font-bold uppercase tracking-[0.14em] text-brutal-ink mb-1.5';

const Badge = ({ tone = 'ink', children }) => {
  const map = {
    ink: 'bg-brutal-ink text-brutal-paper',
    emerald: 'bg-emerald-200 text-emerald-900',
    rose: 'bg-rose-200 text-rose-900',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] border-2 border-brutal-ink ${map[tone]}`}>
      {children}
    </span>
  );
};

const VerifyEmail = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isLoading, user } = useSelector((state) => state.auth);
  const [verificationStatus, setVerificationStatus] = useState('verifying');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendEmail, setResendEmail] = useState('');
  const [emailError, setEmailError] = useState('');

  const token = searchParams.get('token');

  useEffect(() => {
    if (token) {
      handleVerification();
    } else {
      setVerificationStatus('error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    let interval;
    if (resendCooldown > 0) {
      interval = setInterval(() => setResendCooldown((p) => p - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [resendCooldown]);

  useEffect(() => {
    if (user?.email && !resendEmail) setResendEmail(user.email);
  }, [user, resendEmail]);

  const handleVerification = async () => {
    try {
      await dispatch(verifyEmail(token)).unwrap();
      setVerificationStatus('success');
      setTimeout(() => navigate('/'), 3000);
    } catch (_) {
      setVerificationStatus('error');
    }
  };

  const handleResendEmail = async (e) => {
    if (e) e.preventDefault();
    if (resendCooldown > 0) return;
    setEmailError('');
    if (!resendEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resendEmail)) {
      setEmailError('Please enter a valid email address');
      return;
    }
    setResendLoading(true);
    try {
      await dispatch(resendVerificationEmail(resendEmail)).unwrap();
      setResendCooldown(60);
    } catch (_) {} finally {
      setResendLoading(false);
    }
  };

  return (
    <BrutalistScreen>
      <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-6">
          {verificationStatus === 'verifying' && (
            <>
              <div className="text-left">
                <div className="inline-flex items-center gap-2 bg-brutal-ink text-brutal-paper px-3 py-1.5 mb-4">
                  <span className="h-2 w-2 bg-brutal-accent" />
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em]">PFIMS · Verify</span>
                </div>
                <h1 className="font-display text-5xl font-extrabold leading-[0.95] tracking-tight text-brutal-ink">
                  Verifying<span className="text-brutal-accent">.</span>
                </h1>
              </div>
              <BrutalCard className="p-6 sm:p-7 space-y-5">
                <div className="flex items-center gap-4">
                  <Loader2 className="h-10 w-10 text-brutal-ink animate-spin" strokeWidth={2.5} />
                  <Badge tone="ink">
                    <span className="h-1.5 w-1.5 bg-brutal-accent animate-pulse" />
                    In progress
                  </Badge>
                </div>
                <p className="text-base text-brutal-ink leading-relaxed">
                  Hang tight — we're checking the link against our records. This only takes a second.
                </p>
                <div className="h-1 w-full bg-brutal-paper border border-brutal-ink overflow-hidden">
                  <div className="h-full w-1/3 bg-brutal-ink animate-pulse" />
                </div>
              </BrutalCard>
            </>
          )}

          {verificationStatus === 'success' && (
            <>
              <div className="text-left">
                <div className="inline-flex items-center gap-2 bg-brutal-ink text-brutal-paper px-3 py-1.5 mb-4">
                  <span className="h-2 w-2 bg-brutal-accent" />
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em]">PFIMS · Verified</span>
                </div>
                <h1 className="font-display text-5xl font-extrabold leading-[0.95] tracking-tight text-brutal-ink">
                  All set<span className="text-brutal-accent">.</span>
                </h1>
              </div>
              <BrutalCard className="p-6 sm:p-7 space-y-5">
                <div className="flex items-center gap-4">
                  <MailCheck className="h-10 w-10 text-brutal-ink" strokeWidth={2.2} />
                  <Badge tone="emerald">
                    <ShieldCheck size={12} />
                    Email verified
                  </Badge>
                </div>
                <p className="text-base text-brutal-ink leading-relaxed">
                  Your email address has been verified. We'll take you to the dashboard in a moment.
                </p>
                <ul className="space-y-2 text-sm text-brutal-ink">
                  <li className="flex items-center gap-2.5">
                    <span className="h-2 w-2 bg-emerald-700" />
                    Confirmations & statements now deliver correctly.
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="h-2 w-2 bg-cyan-700" />
                    Two-factor login via OTP is ready to use.
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="h-2 w-2 bg-rose-700" />
                    Personalised recommendations just unlocked.
                  </li>
                </ul>
                <Link to="/" className={brutalBtn}>
                  Go to dashboard →
                </Link>
              </BrutalCard>
            </>
          )}

          {verificationStatus === 'error' && (
            <>
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
                <div className="flex items-center gap-4">
                  <AlertTriangle className="h-10 w-10 text-brutal-ink" strokeWidth={2.2} />
                  <Badge tone="rose">
                    <AlertTriangle size={12} />
                    Link expired
                  </Badge>
                </div>
                <p className="text-base text-brutal-ink leading-relaxed">
                  {!token
                    ? 'This link looks malformed or is missing its token. Request a fresh one below.'
                    : "The verification link is invalid or has expired. We've all done it — request a new one below."}
                </p>

                {(!user || !user.isEmailVerified) && (
                  <form onSubmit={handleResendEmail} className="space-y-4">
                    <div>
                      <label htmlFor="resend-email" className={brutalLabel}>Email address</label>
                      <div className="relative">
                        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-brutal-ink/50">
                          <Mail size={16} />
                        </span>
                        <input id="resend-email" type="email" value={resendEmail} onChange={(e) => { setResendEmail(e.target.value); if (emailError) setEmailError(''); }} placeholder="you@pfims.app" className={brutalInput + ' pl-10'} autoComplete="email" aria-invalid={Boolean(emailError)} />
                      </div>
                      {emailError && <p className="mt-1 text-xs font-semibold text-brutal-accent">{emailError}</p>}
                    </div>
                    <button type="submit" disabled={resendLoading || resendCooldown > 0} className={brutalBtn}>
                      {resendLoading ? (
                        <><Loader2 size={16} className="animate-spin mr-2" /> Sending…</>
                      ) : resendCooldown > 0 ? (
                        <><RefreshCw size={16} className="mr-2" /> Resend in {resendCooldown}s</>
                      ) : (
                        <><Mail size={16} className="mr-2" /> Resend verification email</>
                      )}
                    </button>
                  </form>
                )}

                <Link to="/login" className={brutalBtnSecondary}>
                  <ArrowLeft size={16} className="mr-2" />
                  Back to login
                </Link>
              </BrutalCard>
            </>
          )}

          {isLoading && verificationStatus !== 'verifying' && null}
        </div>
      </div>
    </BrutalistScreen>
  );
};

export default VerifyEmail;