(function () {
  const rowsContainer = document.getElementById('subject-rows');
  const addBtn = document.getElementById('add-subject-btn');
  const continueBtn = document.getElementById('continue-btn');
  const formError = document.getElementById('form-error');

  const stepEntry = document.getElementById('step-entry');
  const stepAnalyzing = document.getElementById('step-analyzing');
  const stepResults = document.getElementById('step-results');
  const analyzeListItems = Array.from(document.querySelectorAll('#analyze-list li'));

  let rowCount = 0;
  let lastAnalysis = null; // { resultId, summary, results }

  const DEFAULT_SUBJECTS = ['Mathematics', 'English', 'Kiswahili', 'Biology', 'Chemistry', 'Physics', 'History'];

  function addSubjectRow(prefill = '') {
    rowCount += 1;
    const rowId = `row-${rowCount}`;
    const row = el('div', { class: 'subject-row', 'data-row-id': rowId });

    const select = el('select', { 'aria-label': 'Subject' });
    select.appendChild(el('option', { value: '' , text: 'Select subject…'}));
    KCSE_SUBJECTS.forEach(s => select.appendChild(el('option', { value: s, text: s })));
    if (prefill) select.value = prefill;

    const gradeSelect = el('select', { 'aria-label': 'Grade' });
    gradeSelect.appendChild(el('option', { value: '', text: 'Grade' }));
    KCSE_GRADES.forEach(g => gradeSelect.appendChild(el('option', { value: g, text: g })));

    const removeBtn = el('button', {
      class: 'icon-btn', type: 'button', 'aria-label': 'Remove subject',
      onclick: () => { row.remove(); }
    }, '×');

    row.appendChild(select);
    row.appendChild(gradeSelect);
    row.appendChild(removeBtn);
    rowsContainer.appendChild(row);
  }

  DEFAULT_SUBJECTS.forEach(s => addSubjectRow(s));

  addBtn.addEventListener('click', () => addSubjectRow());

  function collectSubjects() {
    const rows = Array.from(rowsContainer.querySelectorAll('.subject-row'));
    const subjects = [];
    for (const row of rows) {
      const [subjectSelect, gradeSelect] = row.querySelectorAll('select');
      const subject = subjectSelect.value.trim();
      const grade = gradeSelect.value.trim();
      if (!subject && !grade) continue; // skip fully empty rows
      if (!subject || !grade) {
        return { error: 'Every subject row needs both a subject and a grade selected (or remove the empty row).' };
      }
      if (subjects.some(s => s.subject.toLowerCase() === subject.toLowerCase())) {
        return { error: `You've entered "${subject}" more than once. Please remove the duplicate.` };
      }
      subjects.push({ subject, grade });
    }
    if (subjects.length < 7) {
      return { error: 'Please enter at least 7 subjects, including Mathematics and a language.' };
    }
    if (!subjects.some(s => s.subject === 'Mathematics')) {
      return { error: 'Mathematics is mandatory — please add it.' };
    }
    const languages = ['English', 'Kiswahili', 'Kenya Sign Language'];
    if (!subjects.some(s => languages.includes(s.subject))) {
      return { error: 'At least one language (English, Kiswahili, or KSL) is mandatory.' };
    }
    return { subjects };
  }

  continueBtn.addEventListener('click', async () => {
    clearError(formError);
    const result = collectSubjects();
    if (result.error) {
      showError(formError, result.error);
      return;
    }
    runAnalysis(result.subjects);
  });

  async function runAnalysis(subjects) {
    stepEntry.classList.add('hidden');
    stepAnalyzing.classList.remove('hidden');
    analyzeListItems.forEach(li => li.classList.remove('done'));

    // Kick off the real API call immediately; animate ticks while it resolves.
    const apiPromise = CymorAPI.analyze(subjects).catch(err => ({ __error: err }));

    for (let i = 0; i < analyzeListItems.length; i++) {
      await new Promise(r => setTimeout(r, 260));
      analyzeListItems[i].classList.add('done');
    }

    const data = await apiPromise;
    stepAnalyzing.classList.add('hidden');

    if (data && data.__error) {
      stepEntry.classList.remove('hidden');
      showError(formError, data.__error.message || 'Something went wrong analyzing your results. Please try again.');
      return;
    }

    lastAnalysis = data;
    renderResults(data);
    stepResults.classList.remove('hidden');
  }

  function renderResults(data) {
    document.getElementById('stat-mean-grade').textContent = data.summary.meanGrade || '—';
    document.getElementById('stat-aggregate').textContent = `${data.summary.totalPoints} / 84`;
    document.getElementById('stat-count').textContent = data.qualifyingCount;

    const downloadBtn = document.getElementById('download-pdf-btn');
    if (data.resultId) {
      downloadBtn.href = CymorAPI.resultPdfUrl(data.resultId);
      downloadBtn.classList.remove('hidden');
    } else {
      downloadBtn.classList.add('hidden'); // demo mode without DB has no persisted result to fetch as PDF
    }

    const list = document.getElementById('results-list');
    const emptyState = document.getElementById('empty-state');
    list.innerHTML = '';

    if (!data.results || data.results.length === 0) {
      emptyState.classList.remove('hidden');
      return;
    }
    emptyState.classList.add('hidden');

    data.results.forEach(r => {
      const card = el('div', { class: 'card result-card', onclick: () => openCourseModal(r) }, [
        el('div', { class: 'result-top' }, [
          el('div', {}, [
            el('div', { class: 'result-name', text: titleCase(r.programmeName) }),
            el('div', { class: 'result-inst', text: titleCase(r.institutionName) })
          ]),
          el('span', { class: 'result-rank', text: `Rank ${r.rank}` })
        ]),
        el('div', { class: 'result-metrics' }, [
          metric('Application Code', r.programmeCode),
          metric('Your Score', r.learnerScore != null ? r.learnerScore.toFixed(2) + ' / 48' : '—'),
          metric('Latest Cutoff', r.latestCutoff != null ? r.latestCutoff.toFixed(2) + ' / 48' : '—'),
          metric('Margin', (r.margin >= 0 ? '+' : '') + r.margin.toFixed(2)),
          el('span', { class: 'badge-qualifies', text: 'QUALIFIES' })
        ])
      ]);
      list.appendChild(card);
    });
  }

  function metric(label, value) {
    return el('div', { class: 'metric' }, [
      el('div', { class: 'label', text: label }),
      el('div', { class: 'value', text: value })
    ]);
  }

  function titleCase(str) {
    if (!str) return '';
    return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  }

  function openCourseModal(r) {
    const modal = document.getElementById('course-modal');
    const body = document.getElementById('modal-body');
    body.innerHTML = '';
    body.appendChild(el('div', { class: 'eyebrow', text: `Rank ${r.rank} · ${r.programmeCode}` }));
    body.appendChild(el('h3', { style: 'margin:10px 0 4px;', text: titleCase(r.programmeName) }));
    body.appendChild(el('p', { class: 'muted', text: titleCase(r.institutionName) }));
    body.appendChild(el('div', { style: 'height:1px;background:var(--border);margin:18px 0;' }));

    const rows = [
      ['Your weighted cluster score', (r.learnerScore != null ? r.learnerScore.toFixed(3) : '—') + ' / 48'],
      ['Most recent cutoff', (r.latestCutoff != null ? r.latestCutoff.toFixed(3) : '—') + ' / 48' + (r.latestCutoffYear ? ` (${r.latestCutoffYear})` : '')],
      ['Margin above cutoff', (r.margin >= 0 ? '+' : '') + r.margin.toFixed(3)],
      ['Qualification status', 'Qualifies']
    ];
    rows.forEach(([label, value]) => {
      body.appendChild(el('div', { style: 'display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--border);' }, [
        el('span', { class: 'muted', text: label }),
        el('span', { style: 'font-weight:700;', text: value })
      ]));
    });

    body.appendChild(el('p', { class: 'muted', style: 'margin-top:16px;font-size:0.85rem;',
      text: 'You qualify because your weighted cluster score meets or exceeds this programme\u2019s most recent cutoff, and your grades satisfy the minimum subject requirements found in the active KUCCPS dataset for this programme.' }));

    modal.classList.remove('hidden');
  }

  document.getElementById('modal-close-btn').addEventListener('click', () => {
    document.getElementById('course-modal').classList.add('hidden');
  });
  document.getElementById('course-modal').addEventListener('click', (e) => {
    if (e.target.id === 'course-modal') e.currentTarget.classList.add('hidden');
  });

  document.getElementById('review-grades-btn').addEventListener('click', () => {
    stepResults.classList.add('hidden');
    stepEntry.classList.remove('hidden');
  });
})();
