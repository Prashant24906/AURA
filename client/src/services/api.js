import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Store token getter/setter externally to avoid circular imports
let getToken = () => null;
let onUnauthorized = () => {};

export const setTokenGetter = (fn) => { getToken = fn; };
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

// Request interceptor — attach access token
api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — auto-refresh on 401
let isRefreshing = false;
let pendingRequests = [];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const errorCode = error.response?.data?.error;

    if (status === 401 && errorCode === 'TokenExpired' && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingRequests.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const resp = await axios.post(
          `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/auth/refresh`,
          {},
          { withCredentials: true }
        );
        const newToken = resp.data.data.accessToken;
        pendingRequests.forEach(({ resolve }) => resolve(newToken));
        pendingRequests = [];
        isRefreshing = false;
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        pendingRequests.forEach(({ reject }) => reject(refreshError));
        pendingRequests = [];
        isRefreshing = false;
        onUnauthorized();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
