import api from './api';

export const documentAccessService = {
  getMine: () => api.get('/document-access/me'),
  grant: (recordId) => api.put(`/document-access/${recordId}/grant`),
  revoke: (recordId) => api.put(`/document-access/${recordId}/revoke`),
};
