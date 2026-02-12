import api from './api';

const chatAPI = {
  // Sessions
  listSessions: (params = {}) => api.get('/chatbot/sessions', Object.keys(params).length ? { params } : undefined),
  getSession: (id) => api.get(`/chatbot/sessions/${id}`),
  createSession: (title) => api.post('/chatbot/sessions', title ? { title } : {}),
  renameSession: (id, title) => api.patch(`/chatbot/sessions/${id}`, { title }),
  deleteSession: (id) => api.delete(`/chatbot/sessions/${id}`),

  // Messaging
  sendMessage: ({ sessionId, message, extraContext, history = [], includeContext = true, debug = false, lite = false }) => {
    const payload = { message, history, includeContext, debug, lite };
    if (extraContext) payload.extraContext = extraContext;
    // Only include sessionId if it is a valid non-empty value
    if (sessionId) payload.sessionId = sessionId;
    return api.post('/chatbot/message', payload, { timeout: 60000 });
  }
};

export default chatAPI;
