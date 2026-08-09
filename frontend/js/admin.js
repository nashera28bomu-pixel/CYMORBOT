(function () {
  const token = localStorage.getItem('cymor_admin_token');
  if (!token) {
    window.location.href = 'login.html';
    return;
  }

  async function adminRequest(path, options = {}) {
    return apiRequest(path, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) }
    });
  }

  document.getElementById('logout-link').addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('cymor_admin_token');
    window.location.href = 'login.html';
  });

  function statusBadge(status) {
    return `<span class="status-badge status-${status}">${status.toUpperCase()}</span>`;
  }

  async function loadDashboard() {
    try {
      const data = await adminRequest('/admin/dashboard');
      document.getElementById('stat-year').textContent = data.activeDataset ? data.activeDataset.academicYear : 'None active';
      document.getElementById('stat-programmes').textContent = data.programmeCount;
      document.getElementById('stat-institutions').textContent = data.institutionCount;
      document.getElementById('stat-last-import').textContent = data.lastImport
        ? new Date(data.lastImport.createdAt).toLocaleDateString()
        : '—';
    } catch (err) {
      if (String(err.message).includes('expired') || String(err.message).includes('token')) {
        localStorage.removeItem('cymor_admin_token');
        window.location.href = 'login.html';
      }
    }
  }

  async function loadDatasets() {
    const tbody = document.getElementById('datasets-table-body');
    try {
      const datasets = await adminRequest('/admin/datasets');
      if (!datasets.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="muted">No datasets yet. Create one below, then upload source PDFs and import.</td></tr>';
        return;
      }
      tbody.innerHTML = datasets.map(d => `
        <tr>
          <td>${d.academicYear}</td>
          <td>${statusBadge(d.status)}</td>
          <td>${d.importedProgrammeCount || 0}</td>
          <td>${d.recordsRequiringReview || 0}</td>
          <td>
            ${d.status !== 'active' ? `<button class="btn btn-ghost btn-sm activate-btn" data-id="${d._id}">Import + Activate</button>` : '<span class="muted" style="font-size:0.82rem;">Active</span>'}
          </td>
        </tr>
      `).join('');
      tbody.querySelectorAll('.activate-btn').forEach(btn => {
        btn.addEventListener('click', () => runImportAndActivate(btn.dataset.id));
      });
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" class="muted">${err.message}</td></tr>`;
    }
  }

  async function runImportAndActivate(id) {
    try {
      await adminRequest(`/admin/datasets/${id}/import`, { method: 'POST' });
      const preview = await adminRequest(`/admin/datasets/${id}/validation`);
      const proceed = confirm(
        `Import complete.\n\nProgrammes: ${preview.importedProgrammeCount}\nWith cutoff data: ${preview.recordsWithCutoffData}\nItems requiring review: ${preview.recordsRequiringReview}\n\nActivate this dataset now?`
      );
      if (proceed) {
        await adminRequest(`/admin/datasets/${id}/activate`, { method: 'POST' });
      }
      loadDashboard();
      loadDatasets();
    } catch (err) {
      alert(err.message);
    }
  }

  document.getElementById('new-dataset-btn').addEventListener('click', () => {
    document.getElementById('new-dataset-form').classList.toggle('hidden');
  });

  document.getElementById('create-dataset-btn').addEventListener('click', async () => {
    const academicYear = document.getElementById('new-year-input').value.trim();
    if (!academicYear) return;
    try {
      const dataset = await adminRequest('/admin/datasets', {
        method: 'POST',
        body: JSON.stringify({ academicYear })
      });
      alert(`Dataset ${dataset.academicYear} created (id: ${dataset._id}). Next: upload the requirements and cutoffs PDFs via the API endpoints:\nPOST /api/admin/datasets/${dataset._id}/upload-requirements\nPOST /api/admin/datasets/${dataset._id}/upload-cutoffs\nThen call /import, review /validation, and /activate.`);
      document.getElementById('new-year-input').value = '';
      loadDashboard();
    } catch (err) {
      alert(err.message);
    }
  });

  let searchTimer = null;
  document.getElementById('programme-search').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    const q = e.target.value.trim();
    searchTimer = setTimeout(() => searchProgrammes(q), 350);
  });

  async function searchProgrammes(q) {
    const tbody = document.getElementById('programmes-table-body');
    if (!q) {
      tbody.innerHTML = '<tr><td colspan="4" class="muted">Search to view programmes.</td></tr>';
      return;
    }
    tbody.innerHTML = '<tr><td colspan="4" class="muted">Searching…</td></tr>';
    try {
      const data = await adminRequest(`/admin/programmes?q=${encodeURIComponent(q)}&limit=25`);
      if (!data.items.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="muted">No matches.</td></tr>';
        return;
      }
      tbody.innerHTML = data.items.map(p => `
        <tr>
          <td>${p.programmeCode}</td>
          <td>${p.programmeName}</td>
          <td>${p.institutionName}</td>
          <td>${p.latestCutoff ? p.latestCutoff.score.toFixed(3) : '—'}</td>
        </tr>
      `).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="4" class="muted">${err.message}</td></tr>`;
    }
  }

  loadDashboard();
  loadDatasets();
})();
