import api from './api';

const chatAPI = {
  // Sessions
  listSessions: () => api.get('/chatbot/sessions'),
  getSession: (id) => api.get(`/chatbot/sessions/${id}`),
  createSession: (title) => api.post('/chatbot/sessions', title ? { title } : {}),
  renameSession: (id, title) => api.patch(`/chatbot/sessions/${id}`, { title }),
  deleteSession: (id) => api.delete(`/chatbot/sessions/${id}`),

  // Messaging
  sendMessage: ({ sessionId, message, history = [], includeContext = true, debug = false, lite = false }) => {
    const payload = { message, history, includeContext, debug, lite };
    // Only include sessionId if it is a valid non-empty value
    if (sessionId) payload.sessionId = sessionId;
    return api.post('/chatbot/message', payload);
  }
};

export default chatAPI;