(function(){
  function parentEsc(value){
    if (typeof escapeHtml === 'function') return escapeHtml(value);
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  if (typeof document === 'undefined' || !document.body || document.body.dataset.page !== 'parent') return;
  const $ = (id) => document.getElementById(id);

  async function loadDashboard(){
    const studentId = String($('parentStudentId')?.value || '').trim();
    const pin = String($('parentStudentPin')?.value || '').trim();
    if (!studentId || !pin) {
      if ($('parentStatus')) $('parentStatus').textContent = 'Enter student ID and PIN.';
      return;
    }
    if ($('parentStatus')) $('parentStatus').textContent = 'Loading...';
    try {
      const res = await fetch('/api/homework?action=parent-summary', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ studentId, pin })
      });
      const data = await res.json().catch(() => ({ ok:false, error:'Could not load dashboard.' }));
      if (!res.ok || !data.ok) throw new Error(data.error || 'Could not load dashboard.');

      if ($('parentStudentName')) $('parentStudentName').textContent = `${data.student.name} (${data.student.studentId})`;
      if ($('parentAverage')) $('parentAverage').textContent = `${Number(data.summary.averagePercent || 0)}%`;
      if ($('parentBest')) $('parentBest').textContent = `${Number(data.summary.bestPercent || 0)}%`;
      if ($('parentTotal')) $('parentTotal').textContent = String(data.summary.totalSubmissions || 0);

      const rows = Array.isArray(data.rows) ? data.rows : [];
      if ($('parentHistoryBody')) $('parentHistoryBody').innerHTML = rows.map((row) =>
        `<tr><td>${parentEsc(String(row.submittedAt || '').slice(0,10))}</td><td>${parentEsc(String(row.homeworkTitle || '-'))}</td><td>${parentEsc(String(row.score || 0))} / ${parentEsc(String(row.questionCount || 0))}</td><td>${parentEsc(String(row.percent || 0))}%</td><td>${parentEsc(String(row.wrongAnswersCount || 0))}</td></tr>`
      ).join('') || '<tr><td colspan="5">No records found.</td></tr>';

      if ($('parentStatus')) $('parentStatus').textContent = 'Dashboard ready.';
    } catch (error) {
      const msg = (error && error.message) ? String(error.message) : 'Could not load dashboard.';
      const looksLikeMissingBackend = /404|Failed to fetch|Could not load dashboard/i.test(msg);
      if ($('parentStatus')) $('parentStatus').textContent = looksLikeMissingBackend ? 'Parent dashboard needs the homework API backend. Open the app through your server or deploy the API first.' : msg;
      if ($('parentHistoryBody')) $('parentHistoryBody').innerHTML = `<tr><td colspan="5">${parentEsc(looksLikeMissingBackend ? 'Backend not available yet.' : 'No records found.')}</td></tr>`;
    }
  }

  $('loadParentDashboardBtn')?.addEventListener('click', loadDashboard);
  $('parentStudentPin')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') loadDashboard(); });
})();