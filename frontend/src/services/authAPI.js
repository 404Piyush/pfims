import api from './api';

const authAPI = {
  // Authentication
  login: (credentials) => {
    return api.post('/auth/login', credentials);
  },

  register: (userData) => {
    return api.post('/auth/register', userData);
  },

  logout: () => {
    return api.post('/auth/logout');
  },

  // OTP
  sendOtp: ({ email, purpose, password }) => {
    return api.post('/auth/otp/send', { email, purpose, password });
  },

  verifyOtp: ({ email, purpose, code }) => {
    return api.post('/auth/otp/verify', { email, purpose, code });
  },

  // Password management
  forgotPassword: (email) => {
    return api.post('/auth/forgot-password', { email });
  },

  resetPassword: (token, password) => {
    return api.post('/auth/reset-password', { token, password });
  },

  changePassword: (passwordData) => {
    return api.post('/auth/change-password', passwordData);
  },

  // Email verification
  verifyEmail: (token) => {
    return api.post('/auth/verify-email', { token });
  },

  resendVerificationEmail: (email) => {
    return api.post('/auth/resend-verification', { email });
  },

  // Profile management
  getProfile: () => {
    return api.get('/auth/me');
  },

  updateProfile: (profileData) => {
    return api.put('/users/profile', profileData);
  },

  saveInvestmentProfile: (payload) => {
    return api.put('/users/investment-profile', payload);
  },

  changeEmail: (emailData) => {
    // Backend expects PUT /api/users/email with { email, password }
    return api.put('/users/email', emailData);
  },

  deactivateAccount: (confirmationData) => {
    // Backend exposes DELETE /api/users/account; axios supports body via config.data
    return api.delete('/users/account', { data: confirmationData });
  },

  // User statistics
  getUserStats: () => {
    return api.get('/users/stats');
  },

  // Refresh token (if implementing refresh token strategy)
  refreshToken: () => {
    return api.post('/auth/refresh');
  },

  // Check if email exists (for registration validation)
  checkEmail: (email) => {
    return api.post('/auth/check-email', { email });
  },

  // Social authentication (if implementing)
  googleAuth: (token) => {
    return api.post('/auth/google', { token });
  },

  facebookAuth: (token) => {
    return api.post('/auth/facebook', { token });
  },
};

export default authAPI;
