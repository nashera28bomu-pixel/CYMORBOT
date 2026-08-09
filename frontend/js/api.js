// Cymor KUCCPS Advisor — API configuration
// Change API_BASE_URL between environments without touching other files.
const API_BASE_URL = window.CYMOR_API_BASE_URL || 'http://localhost:5000';

async function apiRequest(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}/api${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  let body;
  try { body = await res.json(); } catch (e) { body = null; }
  if (!res.ok || !body || body.success === false) {
    const message = body && body.error ? body.error.message : `Request failed (${res.status}).`;
    throw new Error(message);
  }
  return body.data;
}

const CymorAPI = {
  health: () => apiRequest('/health'),
  activeDataset: () => apiRequest('/datasets/active'),
  analyze: (subjects) => apiRequest('/checker/analyze', { method: 'POST', body: JSON.stringify({ subjects }) }),
  getResult: (id) => apiRequest(`/results/${id}`),
  resultPdfUrl: (id) => `${API_BASE_URL}/api/results/${id}/pdf`
};
