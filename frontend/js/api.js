// Cymor KUCCPS Advisor — API configuration
// Production API: https://coursechecker-w9yf.onrender.com

const API_BASE_URL =
  window.CYMOR_API_BASE_URL ||
  'https://coursechecker-w9yf.onrender.com';

async function apiRequest(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}/api${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  let body;

  try {
    body = await res.json();
  } catch (e) {
    body = null;
  }

  if (!res.ok || !body || body.success === false) {
    const message =
      body && body.error
        ? body.error.message
        : `Request failed (${res.status}).`;

    throw new Error(message);
  }

  return body.data;
}

const CymorAPI = {
  // API health check
  health: () => apiRequest('/health'),

  // Get currently active KUCCPS dataset
  activeDataset: () => apiRequest('/datasets/active'),

  // Analyze learner's KCSE subjects
  analyze: (subjects) =>
    apiRequest('/checker/analyze', {
      method: 'POST',
      body: JSON.stringify({
        subjects
      })
    }),

  // Retrieve previously generated result
  getResult: (id) =>
    apiRequest(`/results/${id}`),

  // Generate/access result PDF
  resultPdfUrl: (id) =>
    `${API_BASE_URL}/api/results/${id}/pdf`
};
