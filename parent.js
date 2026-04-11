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

  const LOCAL_KEY = 'kgHomeworkStaticStoreV1';
  function localSummary(studentId, pin){
    try {
      const store = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}');
      const students = Array.isArray(store.students) ? store.students : [];
      const student = students.find((row) => String(row.studentId || '').trim() === studentId && String(row.pin || '').trim() === pin);
      if (!student) throw new Error('Student ID or PIN is not correct');
      const rows = (Array.isArray(store.submissions) ? store.submissions : []).filter((row) => String(row.studentId || '').trim() === studentId).sort((a,b) => String(b.submittedAt || '').localeCompare(String(a.submittedAt || '')));
      const percents = rows.map((row) => Number(row.percent || 0) || 0);
      const averagePercent = percents.length ? Math.round(percents.reduce((sum, value) => sum + value, 0) / percents.length) : 0;
      const bestPercent = percents.length ? Math.max.apply(null, percents) : 0;
      return { ok:true, student, rows, summary:{ averagePercent, bestPercent, totalSubmissions: rows.length } };
    } catch (error) {
      return { ok:false, error: error.message || 'Could not load dashboard.' };
    }
  }

  async function loadDashboard(){
    const studentId = String($('parentStudentId')?.value || '').trim();
    const pin = String($('parentStudentPin')?.value || '').trim();
    if (!studentId || !pin) {
      if ($('parentStatus')) $('parentStatus').textContent = 'Enter student ID and PIN.';
      return;
    }
    if ($('parentStatus')) $('parentStatus').textContent = 'Loading...';
    try {
      let data;
      try {
        const res = await fetch('/api/homework?action=parent-summary', {
          method:'POST',
          headers:{ 'Content-Type':'application/json' },
          body: JSON.stringify({ studentId, pin })
        });
        data = await res.json().catch(() => ({ ok:false, error:'Could not load dashboard.' }));
        if (!res.ok || !data.ok) throw new Error(data.error || 'Could not load dashboard.');
      } catch (error) {
        data = localSummary(studentId, pin);
        if (!data.ok) throw new Error(data.error || 'Could not load dashboard.');
      }

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
      if ($('parentStatus')) $('parentStatus').textContent = msg;
      if ($('parentHistoryBody')) $('parentHistoryBody').innerHTML = `<tr><td colspan="5">${parentEsc('No records found.')}</td></tr>`;
    }
  }

  $('loadParentDashboardBtn')?.addEventListener('click', loadDashboard);
  $('parentStudentPin')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') loadDashboard(); });
})();