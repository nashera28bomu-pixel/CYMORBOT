// Single place to change the backend API URL between environments.
// Every HTML page loads this file BEFORE js/api.js, so this is the only
// file you need to edit when moving between local dev and production.
//
// Development:  http://localhost:5000
// Production:   https://coursechecker-w9yf.onrender.com
window.CYMOR_API_BASE_URL = 'https://coursechecker-w9yf.onrender.com';
