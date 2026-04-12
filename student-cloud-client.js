(function(){
  const API_BASE = '/api/student';
  const IDENTITY_KEY = 'kgStudentIdentityV1';

  function $(id){ return document.getElementById(id); }
  function slugify(value){ return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''); }
  function readIdentity(){
    try { return JSON.parse(localStorage.getItem(IDENTITY_KEY) || 'null'); } catch (error) { return null; }
  }
  function saveIdentity(identity){
    try { localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity)); } catch (error) {}
  }
  function renderInviteCard(data){
    const card = $('guestInviteCard');
    if (!card) return;
    const show = !!(data && data.isGuest);
    card.classList.toggle('hidden', !show);
    if (!show) return;
    const nameEl = $('guestInviteName');
    if (nameEl) nameEl.textContent = data.studentName || data.name || 'Dear student';
  }
  const LOCAL_CLOUD_KEY = 'kgStudentCloudLocalV1';
  function readLocalCloud(){
    try { return JSON.parse(localStorage.getItem(LOCAL_CLOUD_KEY) || '{"sessions":{},"results":{}}'); }
    catch (error) { return { sessions:{}, results:{} }; }
  }
  function writeLocalCloud(store){
    const safe = store && typeof store === 'object' ? store : { sessions:{}, results:{} };
    try { localStorage.setItem(LOCAL_CLOUD_KEY, JSON.stringify(safe)); } catch (error) {}
    return safe;
  }
  function localIdentity(payload){ return Object.assign({ name:'', studentId:'', grade:'', className:'', isGuest:false }, payload || {}); }
  function resultKeyPart(value){ return encodeURIComponent(String(value || '').trim().toLowerCase()); }
  function resultKey(identity, quizKey){ return ['v2', resultKeyPart(String(identity.grade || '').trim().toUpperCase()), resultKeyPart(identity.className || ''), resultKeyPart(identity.studentId || ''), resultKeyPart(identity.name || ''), resultKeyPart(quizKey || '')].join('::'); }
  function legacyResultKey(identity, quizKey){ return [String(identity.grade || '').trim().toUpperCase(), String(identity.className || '').trim().toLowerCase(), String(identity.studentId || '').trim().toLowerCase(), String(identity.name || '').trim().toLowerCase(), String(quizKey || '').trim()].join('||'); }
  async function post(path, payload){
    try {
      const res = await fetch(API_BASE + path, {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify(payload || {})
      });
      const data = await res.json().catch(()=>({ ok:false, error:'Request failed' }));
      if (!res.ok || !data.ok) throw new Error(data.error || ('Request failed: ' + res.status));
      return data;
    } catch (error) {
      const store = readLocalCloud();
      const identity = localIdentity((payload && payload.identity) || payload || {});
      const quizKey = String((payload && (payload.quizKey || payload.quizId || payload.quiz)) || '').trim();
      if (path === '/start') {
        const key = resultKey(identity, quizKey);
        const legacyKey = legacyResultKey(identity, quizKey);
        const session = store.sessions[key] || store.sessions[legacyKey] || null;
        return { ok:true, identity, quizKey, progress: session && session.state ? session.state : null, result: store.results[key] || store.results[legacyKey] || null };
      }
      if (path === '/save-progress') {
        const key = resultKey(identity, quizKey);
        store.sessions[key] = { identity, state: (payload && (payload.state || payload.progress)) || {}, updatedAt: new Date().toISOString() };
        writeLocalCloud(store);
        return { ok:true };
      }
      if (path === '/submit') {
        const key = resultKey(identity, quizKey);
        const result = (payload && payload.result) || payload || {};
        store.results[key] = result;
        store.sessions[key] = { identity, state: Object.assign({}, (payload && (payload.state || payload.progress)) || {}, { completed:true }), updatedAt: new Date().toISOString() };
        writeLocalCloud(store);
        return { ok:true, result };
      }
      throw error;
    }
  }
  function buildQuizKey(info){
    const grade = String(info.grade || '').trim().toUpperCase();
    const count = Number(info.count || info.selectedCount || 0) || 0;
    const label = String(info.label || info.selectedLevelLabel || info.testName || 'quiz').trim();
    return [grade, count || 'custom', slugify(label || 'quiz')].join('|');
  }
  function ensureQuizIdentityFields(grade){
    const anchor = document.querySelector('.student-form-box') || ($('studentName') && $('studentName').parentElement) || document.querySelector('main') || document.body;
    if (!anchor || $('studentClass')) return;
    const wrap = document.createElement('div');
    wrap.className = 'student-cloud-grid';
    wrap.innerHTML = [
      '<input id="studentId" placeholder="Student ID (Optional)" maxlength="40">',
      '<input id="studentClass" placeholder="Class / Course" maxlength="40">',
      '<label class="student-cloud-check"><input type="checkbox" id="studentGuest"> <span>I am not in your class / course / school</span></label>',
      '<p class="student-cloud-note">Name is required. Student ID is optional. Class is required unless the outside-student option is checked.</p>'
    ].join('');
    const nameInput = $('studentName');
    if (nameInput && nameInput.parentNode) nameInput.insertAdjacentElement('afterend', wrap);
    const existing = readIdentity();
    if (existing && String(existing.grade || '').toUpperCase() === String(grade || '').toUpperCase()) {
      if ($('studentName') && existing.name) $('studentName').value = existing.name;
      if ($('studentId') && existing.studentId) $('studentId').value = existing.studentId;
      if ($('studentClass') && existing.className && existing.className !== 'Guest') $('studentClass').value = existing.className;
      if ($('studentGuest')) $('studentGuest').checked = !!existing.isGuest;
    }
    $('studentGuest')?.addEventListener('change', function(){
      const disabled = !!this.checked;
      const classInput = $('studentClass');
      if (!classInput) return;
      classInput.disabled = disabled;
      if (disabled) classInput.value = '';
    });
    if ($('studentGuest')?.checked) $('studentClass').disabled = true;
  }
  function collectIdentity(grade){
    const name = String($('studentName')?.value || '').trim();
    const studentId = String($('studentId')?.value || '').trim();
    const isGuest = !!$('studentGuest')?.checked;
    const className = String($('studentClass')?.value || '').trim();
    if (!name) throw new Error('Please enter the student name first.');
    if (!isGuest && !className) throw new Error('Please enter the class or course, or check the outside-student option.');
    const identity = { name, studentId, className: className || 'Guest', isGuest, grade: String(grade || '').toUpperCase() };
    saveIdentity(identity);
    return identity;
  }

  window.studentCloud = {
    ensureQuizIdentityFields,
    collectIdentity,
    buildQuizKey,
    startOrResume(payload){ return post('/start', payload); },
    saveProgress(payload){ return post('/save-progress', payload); },
    submitResult(payload){ return post('/submit', payload); },
    readIdentity,
    renderInviteCard
  };
})();
