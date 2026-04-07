const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('crm_token');
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401) {
    localStorage.removeItem('crm_token');
    localStorage.removeItem('crm_user');
    window.location.reload();
    throw new Error('Sessão expirada');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro na requisição');
  return data;
}

export const api = {
  // Auth
  login: (username, password) => request('/auth/login', { method: 'POST', body: { username, password } }),
  getMe: () => request('/auth/me'),

  // Leads
  getLeads: (params) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/leads${qs}`);
  },
  getLead: (id) => request(`/leads/${id}`),
  createLead: (data) => request('/leads', { method: 'POST', body: data }),
  updateLead: (id, data) => request(`/leads/${id}`, { method: 'PUT', body: data }),
  moveLeadStage: (id, stage_id, deal_value) => request(`/leads/${id}/stage`, { method: 'PUT', body: { stage_id, deal_value } }),
  deleteLead: (id) => request(`/leads/${id}`, { method: 'DELETE' }),

  // SDR Suggestions
  getSuggestions: (leadId) => request(`/leads/${leadId}/suggestions`),
  getObjectionResponse: (leadId, objection_key) => request(`/leads/${leadId}/suggestions/objection`, { method: 'POST', body: { objection_key } }),

  // Pipeline
  getPipeline: () => request('/pipeline'),
  getBoard: () => request('/pipeline/board'),
  getStats: () => request('/pipeline/stats'),

  // Chat
  getConversations: () => request('/chat/conversations'),
  getMessages: (leadId) => request(`/chat/${leadId}/messages`),
  sendMessage: (leadId, content, suggestion_type) => request(`/chat/${leadId}/send`, { method: 'POST', body: { content, suggestion_type } }),
  getWhatsAppStatus: () => request('/chat/status'),
  connectWhatsApp: () => request('/chat/connect', { method: 'POST' }),
  disconnectWhatsApp: () => request('/chat/disconnect', { method: 'POST' }),

  // Settings
  getSettings: () => request('/settings'),
  updateMetaConfig: (data) => request('/settings/meta', { method: 'PUT', body: data }),
  testMetaEvent: () => request('/settings/meta/test', { method: 'POST' }),
};
