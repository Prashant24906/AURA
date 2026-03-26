import api from './api';

export const incidentService = {
  getAll: (params) => api.get('/incidents', { params }),
  getById: (id) => api.get(`/incidents/${id}`),
  create: (data) => api.post('/incidents', data),
  updateStatus: (id, data) => api.patch(`/incidents/${id}/status`, data),
  assign: (id, data) => api.patch(`/incidents/${id}/assign`, data),
  delete: (id) => api.delete(`/incidents/${id}`),

  // Analytics
  getSummary: () => api.get('/analytics/summary'),
  getTrends: (params) => api.get('/analytics/trends', { params }),
  getByZone: () => api.get('/analytics/by-zone'),
  getModelPerformance: () => api.get('/analytics/model-performance'),
  getResolutionTime: () => api.get('/analytics/resolution-time'),

  // Alerts
  getAlerts: () => api.get('/analytics/alerts'),
  markAlertRead: (id) => api.patch(`/analytics/alerts/${id}/read`),
  markAllRead: () => api.post('/analytics/alerts/read-all'),

  // Users
  getUsers: () => api.get('/analytics/users'),
  updateUser: (id, data) => api.patch(`/analytics/users/${id}`, data),

  // Upload
  analyzeAll: (formData) => api.post('/upload/analyze', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  analyzeSingle: (modelType, formData) => api.post(`/upload/analyze/${modelType}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
};
