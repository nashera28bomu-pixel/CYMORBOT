// Lightweight shared page behaviour (kept separate from checker.js /
// admin.js so those stay focused on their own flows).
document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname.split('/').pop();
  document.querySelectorAll('.nav-links a').forEach(a => {
    if (a.getAttribute('href') === path) a.style.color = 'var(--navy-950)';
  });
});
