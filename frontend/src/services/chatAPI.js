import api from './api';

const chatAPI = {
  // Sessions
  listSessions: () => api.get('/chatbot/sessions'),
  getSession: (id) => api.get(`/chatbot/sessions/${id}`),
  createSession: (title) => api.post('/chatbot/sessions', title ? { title } : {}),
  renameSession: (id, title) => api.patch(`/chatbot/sessions/${id}`, { title }),
  deleteSession: (id) => api.delete(`/chatbot/sessions/${id}`),

  // Messaging
  sendMessage: ({ sessionId, message, history = [], includeContext = true, debug = false, lite = false }) =>
    api.post('/chatbot/message', { sessionId, message, history, includeContext, debug, lite })
};

export default chatAPI;