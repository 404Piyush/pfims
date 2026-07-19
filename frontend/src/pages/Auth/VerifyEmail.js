import React, { useEffect, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { verifyEmail, resendVerificationEmail } from '../../store/slices/authSlice';
import {
  CheckCircleIcon,
  XCircleIcon,
  EnvelopeIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import AuroraScreen from '../../components/layout/AuroraScreen';
import AuroraCard from '../../components/ui/AuroraCard';
import LoadingSpinner from '../../components/UI/LoadingSpinner';

const VerifyEmail = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loading, user } = useSelector((state) => state.auth);
  const [verificationStatus, setVerificationStatus] = useState('verifying'); // verifying, success, error
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendEmail, setResendEmail] = useState('');

  const token = searchParams.get('token');

  useEffect(() => {
    if (token) {
      handleVerification();
    } else {
      setVerificationStatus('error');
    }
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
        navigate('/dashboard');
      }, 3000);
    } catch (error) {
      setVerificationStatus('error');
    }
  };

  const handleResendEmail = async () => {
    if (resendCooldown > 0) return;
    
    setResendLoading(true);
    try {
      if (!resendEmail) {
        throw new Error('Please enter your email');
      }
      await dispatch(resendVerificationEmail(resendEmail)).unwrap();
      setResendCooldown(60); // 60 seconds cooldown
    } catch (error) {
      // Error is handled by the slice
    } finally {
      setResendLoading(false);
    }
  };

  if (verificationStatus === 'verifying') {
    return (
      <AuroraScreen>
      <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <AuroraCard accent="indigo" className="p-8 text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-primary-100 mb-6">
              <LoadingSpinner size="md" color="primary" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Verifying your email
            </h2>
            <p className="text-white/70">
              Please wait while we verify your email address...
            </p>
          </AuroraCard>
        </div>
      </div>
      </AuroraScreen>
    );
  }

  if (verificationStatus === 'success') {
    return (
      <AuroraScreen>
      <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <AuroraCard accent="cyan" className="p-8 text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-success-100 mb-6">
              <CheckCircleIcon className="h-8 w-8 text-success-600" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Email verified successfully!
            </h2>
            <p className="text-white/70 mb-6">
              Your email has been verified. You will be redirected to the dashboard shortly.
            </p>
            <Link
              to="/dashboard"
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
            >
              Go to Dashboard
            </Link>
          </AuroraCard>
        </div>
      </div>
      </AuroraScreen>
    );
  }

  return (
    <AuroraScreen>
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <AuroraCard accent="pink" className="p-8 text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-danger-100 mb-6">
            <XCircleIcon className="h-8 w-8 text-danger-600" />
          </div>
          <h2 className="text-2xl font-bold text-secondary-900 mb-2">
            Verification failed
          </h2>
          <p className="text-secondary-600 mb-6">
            {!token 
              ? 'Invalid verification link. The link may be malformed or missing required parameters.'
              : 'This verification link is invalid or has expired. Please request a new verification email.'
            }
          </p>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="resend-email" className="form-label">Email address</label>
              <input
                id="resend-email"
                type="email"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                placeholder="Enter your email"
                className="input"
                autoComplete="email"
              />
            </div>
            {(!user || !user.isEmailVerified) && (
              <button
                onClick={handleResendEmail}
                disabled={resendLoading || resendCooldown > 0}
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {resendLoading ? (
                  <LoadingSpinner size="sm" color="white" />
                ) : resendCooldown > 0 ? (
                  <>
                    <ArrowPathIcon className="h-4 w-4 mr-2" />
                    Resend in {resendCooldown}s
                  </>
                ) : (
                  <>
                    <EnvelopeIcon className="h-4 w-4 mr-2" />
                    Resend verification email
                  </>
                )}
              </button>
            )}
            
            <Link
              to="/login"
              className="w-full flex justify-center py-3 px-4 border border-secondary-300 rounded-lg shadow-sm text-sm font-medium text-secondary-700 bg-white hover:bg-secondary-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
            >
              Back to login
            </Link>
          </div>
        </AuroraCard>
      </div>
    </div>
    </AuroraScreen>
  );
};

export default VerifyEmail;