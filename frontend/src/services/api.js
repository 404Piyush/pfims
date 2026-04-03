import axios from 'axios';
import { toast } from 'react-hot-toast';

const defaultApiBaseUrl = `http://${window.location.hostname || 'localhost'}:5000/api`;

const navigateTo = (path) => {
  if (window.location.pathname === path) return;
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
};

// Create axios instance
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || defaultApiBaseUrl,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    const { response } = error;

    // Handle network errors
    if (!response) {
      toast.error(`Network error. Backend not reachable at ${api.defaults.baseURL}.`);
      return Promise.reject(error);
    }

    // Handle different status codes
    switch (response.status) {
      case 401:
        localStorage.removeItem('token');
        {
          const url = response?.config?.url || '';
          const isAuthRequest =
            url.includes('/auth/login') || url.includes('/auth/register') || url.includes('/auth/otp/');
          if (!isAuthRequest) {
            toast.error('Session expired. Please login again.');
            navigateTo('/login');
          }
        }
        break;

      case 403:
        // Forbidden
        toast.error('You do not have permission to perform this action.');
        break;

      case 404:
        // Not found
        if (!response.config.url.includes('/auth/me')) {
          toast.error('Resource not found.');
        }
        break;

      case 422:
        // Validation error
        const validationErrors = response.data?.errors;
        if (validationErrors && Array.isArray(validationErrors)) {
          validationErrors.forEach((err) => {
            toast.error(err.message || err.msg);
          });
        } else {
          toast.error(response.data?.message || 'Validation error.');
        }
        break;

      case 429:
        // Rate limit exceeded
        toast.error('Too many requests. Please try again later.');
        break;

      case 500:
        // Server error
        toast.error('Server error. Please try again later.');
        break;

      default:
        // Other errors
        const message = response.data?.message || 'An error occurred.';
        if (!response.config.skipErrorToast) {
          toast.error(message);
        }
        break;
    }

    return Promise.reject(error);
  }
);

// Helper functions for common API patterns
export const apiHelpers = {
  // GET request with query parameters
  get: (url, params = {}) => {
    return api.get(url, { params });
  },

  // POST request
  post: (url, data = {}) => {
    return api.post(url, data);
  },

  // PUT request
  put: (url, data = {}) => {
    return api.put(url, data);
  },

  // PATCH request
  patch: (url, data = {}) => {
    return api.patch(url, data);
  },

  // DELETE request
  delete: (url) => {
    return api.delete(url);
  },

  // Upload file
  upload: (url, formData, onUploadProgress = null) => {
    return api.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress,
    });
  },

  // Download file
  download: (url, filename) => {
    return api.get(url, {
      responseType: 'blob',
    }).then((response) => {
      const blob = new Blob([response.data]);
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    });
  },

  // Request without error toast
  silentRequest: (method, url, data = {}) => {
    return api.request({
      method,
      url,
      data,
      skipErrorToast: true,
    });
  },
};

// Export the configured axios instance
export default api;
