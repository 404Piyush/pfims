import axios from 'axios';
import { toast } from 'react-hot-toast';

const navigateTo = (path) => {
  if (window.location.pathname === path) return;
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
};

// Read the CSRF cookie. csrf-csrf stores the value as `token|hash`; the
// server compares ONLY the left half against the `X-CSRF-Token` header.
function readCsrfCookie() {
  const name = 'pfims_csrf=';
  for (const c of (document.cookie || '').split(';')) {
    const trimmed = c.trim();
    if (trimmed.startsWith(name)) {
      const raw = decodeURIComponent(trimmed.slice(name.length));
      const token = raw.split('|')[0];
      if (token) return token;
    }
  }
  return '';
}

// One-shot bootstrap to obtain the CSRF token cookie. Called by the auth
// slice before the first state-changing request.
let csrfBootPromise = null;
export async function ensureCsrf() {
  if (readCsrfCookie()) return;
  if (csrfBootPromise) return csrfBootPromise;
  csrfBootPromise = axios
    .get(
      (process.env.REACT_APP_API_URL || 'http://localhost:3001/api') + '/csrf',
      { withCredentials: true }
    )
    .catch(() => null)
    .finally(() => {
      csrfBootPromise = null;
    });
  return csrfBootPromise;
}

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3001/api',
  timeout: 15000,
  withCredentials: true, // send/receive the httpOnly JWT cookie
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor:
// - Authorization header still wins (useful for the rare non-cookie client)
// - Otherwise rely on the httpOnly cookie.
// - Inject X-CSRF-Token for state-changing methods.
api.interceptors.request.use(
  (config) => {
    const method = (config.method || 'get').toUpperCase();
    const token = localStorage.getItem('pfims.token.legacy');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const csrf = readCsrfCookie();
      if (csrf) config.headers['X-CSRF-Token'] = csrf;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const { response } = error;
    if (!response) {
      toast.error('Network error. Please check your connection.');
      return Promise.reject(error);
    }
    const url = response?.config?.url || '';
    // Routes that must never trigger a "session expired" toast:
    //   - auth endpoints handle their own UX
    //   - /auth/me is the silent bootstrap check on app boot
    const isAuthEndpoint =
      url.includes('/auth/login') ||
      url.includes('/auth/register') ||
      url.includes('/auth/otp/') ||
      url.includes('/auth/refresh') ||
      url.includes('/auth/me');
    switch (response.status) {
      case 401:
        localStorage.removeItem('pfims.token.legacy');
        if (!isAuthEndpoint) {
          toast.error('Session expired. Please login again.');
          navigateTo('/login');
        }
        break;
      case 403:
        toast.error('You do not have permission to perform this action.');
        break;
      case 404:
        if (!url.includes('/auth/me')) {
          toast.error('Resource not found.');
        }
        break;
      case 422: {
        const validationErrors = response.data?.errors;
        if (validationErrors && Array.isArray(validationErrors)) {
          validationErrors.forEach((err) => toast.error(err.message || err.msg));
        } else {
          toast.error(response.data?.message || 'Validation error.');
        }
        break;
      }
      case 429:
        toast.error('Too many requests. Please try again later.');
        break;
      case 500:
        toast.error('Server error. Please try again later.');
        break;
      default: {
        const message = response.data?.message || 'An error occurred.';
        if (!response.config.skipErrorToast) toast.error(message);
        break;
      }
    }
    return Promise.reject(error);
  }
);

export const apiHelpers = {
  get: (url, params = {}) => api.get(url, { params }),
  post: (url, data = {}) => api.post(url, data),
  put: (url, data = {}) => api.put(url, data),
  patch: (url, data = {}) => api.patch(url, data),
  delete: (url) => api.delete(url),
  upload: (url, formData, onUploadProgress = null) =>
    api.post(url, formData, { headers: { 'Content-Type': 'multipart/form-data' }, onUploadProgress }),
  download: (url, filename) =>
    api.get(url, { responseType: 'blob' }).then((response) => {
      const blob = new Blob([response.data]);
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(link.href);
    }),
  silentRequest: (method, url, data = {}) =>
    api.request({ method, url, data, skipErrorToast: true }),
};

export default api;
