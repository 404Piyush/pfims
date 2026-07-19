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
import AuroraScreen from '../../components/layout/AuroraScreen';
import AuroraCard from '../../components/ui/AuroraCard';

const VerifyEmail = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loading, user } = useSelector((state) => state.auth);
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
      interval = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendCooldown]);

  useEffect(() => {
    if (user?.email && !resendEmail) {
      setResendEmail(user.email);
    }
  }, [user, resendEmail]);

  const handleVerification = async () => {
    try {
      await dispatch(verifyEmail(token)).unwrap();
      setVerificationStatus('success');
      setTimeout(() => {
        navigate('/');
      }, 3000);
    } catch (e) {
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
    } catch (err) {
      // slice handles toast
    } finally {
      setResendLoading(false);
    }
  };

  const gradientRing = {
    verifying: 'from-brand-indigo/40 via-brand-cyan/30 to-transparent',
    success: 'from-emerald-400/30 via-brand-cyan/30 to-transparent',
    error: 'from-rose-500/30 via-brand-pink/30 to-transparent',
  };

  const badge = {
    verifying: 'bg-brand-indigo/15 text-brand-cyan border-brand-indigo/30',
    success: 'bg-emerald-400/15 text-emerald-200 border-emerald-400/30',
    error: 'bg-rose-500/15 text-rose-200 border-rose-400/30',
  };

  const Badge = ({ children, status }) => (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${badge[status]}`}
    >
      {children}
    </span>
  );

  return (
    <AuroraScreen>
      <div className="aurora-shell min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          {verificationStatus === 'verifying' && (
            <AuroraCard accent="indigo" className="p-8 text-center">
              <div className={`mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br ${gradientRing.verifying} ring-1 ring-white/10`}>
                <Loader2 className="h-10 w-10 text-white/80 animate-spin" />
              </div>
              <Badge status="verifying">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-cyan opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-cyan" />
                </span>
                Verifying
              </Badge>
              <h2 className="mt-4 text-2xl font-bold text-white">Verifying your email</h2>
              <p className="mt-2 text-sm text-white/70">
                Hang tight — we're checking the link against our records. This only takes a second.
              </p>
              <div className="mt-6 h-1 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-1/3 animate-pulse rounded-full bg-gradient-to-r from-brand-indigo via-brand-cyan to-brand-pink" />
              </div>
            </AuroraCard>
          )}

          {verificationStatus === 'success' && (
            <AuroraCard accent="cyan" className="p-8 text-center">
              <div className={`mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br ${gradientRing.success} ring-1 ring-emerald-300/30`}>
                <MailCheck className="h-10 w-10 text-emerald-200" strokeWidth={1.5} />
              </div>
              <Badge status="success">
                <ShieldCheck size={12} />
                Email verified
              </Badge>
              <h2 className="mt-4 text-2xl font-bold text-white">You're all set!</h2>
              <p className="mt-2 text-sm text-white/70">
                Your email address has been verified. We'll take you to the dashboard in a moment.
              </p>
              <ul className="mt-6 space-y-2 text-left text-sm text-white/70">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Confirmations & statements will now deliver correctly.
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-cyan" />
                  Two-factor login via OTP is ready to use.
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-pink" />
                  Personalised recommendations just unlocked.
                </li>
              </ul>
              <Link to="/" className="btn-primary mt-6 inline-flex w-full items-center justify-center">
                Go to Dashboard
              </Link>
            </AuroraCard>
          )}

          {verificationStatus === 'error' && (
            <AuroraCard accent="pink" className="p-8 text-center">
              <div className={`mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br ${gradientRing.error} ring-1 ring-rose-300/30`}>
                <AlertTriangle className="h-10 w-10 text-rose-200" strokeWidth={1.5} />
              </div>
              <Badge status="error">
                <AlertTriangle size={12} />
                Link expired
              </Badge>
              <h2 className="mt-4 text-2xl font-bold text-white">Verification failed</h2>
              <p className="mt-2 text-sm text-white/70">
                {!token
                  ? 'This link looks malformed or is missing its token. Request a fresh one below.'
                  : "The verification link is invalid or has expired. We've all done it — request a new one below."}
              </p>

              {(!user || !user.isEmailVerified) && (
                <form onSubmit={handleResendEmail} className="mt-6 space-y-3 text-left">
                  <div>
                    <label htmlFor="resend-email" className="form-label">
                      Email address
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-white/40">
                        <Mail size={16} />
                      </span>
                      <input
                        id="resend-email"
                        type="email"
                        value={resendEmail}
                        onChange={(e) => {
                          setResendEmail(e.target.value);
                          if (emailError) setEmailError('');
                        }}
                        placeholder="you@pfims.app"
                        className={`input pl-10 ${emailError ? 'input-error' : ''}`}
                        autoComplete="email"
                        aria-invalid={Boolean(emailError)}
                      />
                    </div>
                    {emailError && <p className="form-error">{emailError}</p>}
                  </div>
                  <button
                    type="submit"
                    disabled={resendLoading || resendCooldown > 0}
                    className="btn-primary inline-flex w-full items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {resendLoading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : resendCooldown > 0 ? (
                      <>
                        <RefreshCw size={16} />
                        Resend in {resendCooldown}s
                      </>
                    ) : (
                      <>
                        <Mail size={16} />
                        Resend verification email
                      </>
                    )}
                  </button>
                </form>
              )}

              <Link
                to="/login"
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white/85 transition hover:bg-white/10"
              >
                <ArrowLeft size={16} />
                Back to login
              </Link>
            </AuroraCard>
          )}
        </div>
      </div>
    </AuroraScreen>
  );
};

export default VerifyEmail;
