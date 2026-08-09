// Cymor KUCCPS Advisor — API configuration
// Change API_BASE_URL between environments without touching other files
// (see js/config.js — that's the one file to edit).
const API_BASE_URL = (window.CYMOR_API_BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');

async function apiRequest(path, options = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE_URL}/api${path}`, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
  } catch (networkErr) {
    // A raw "Failed to fetch" here almost always means one of:
    // 1. The backend URL is wrong or unreachable (check js/config.js)
    // 2. The Render service is asleep/still starting (free tier can take
    //    up to ~50s on first request after inactivity — try again shortly)
    // 3. CORS: the backend's FRONTEND_URL env var doesn't match this
    //    page's exact origin (protocol + domain, no trailing slash)
    throw new Error(`Could not reach the server at ${API_BASE_URL}. It may be starting up, offline, or blocking this origin (CORS). Please try again in a moment.`);
  }

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
