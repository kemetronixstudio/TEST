(function(){
  if (typeof document === 'undefined' || !document.body || document.body.dataset.page !== 'homework') return;
  const API = '/api/homework';
  const $ = (id) => document.getElementById(id);
  const studentCloud = window.studentCloud || null;
  let state = null;
  let timer = null;
  let availableRows = [];
  const localHost = String(location.hostname || '').trim().toLowerCase();
  const isLocalPreview = /^file:$/i.test(String(location.protocol || '')) || /^(localhost|127\.0\.0\.1|::1)$/i.test(localHost) || localHost.endsWith('.local') || localHost.endsWith('.test') || localHost.endsWith('.localhost');
  const esc = (v) => String(v || '').replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  const LOCAL_KEY = 'kgHomeworkStaticStoreV1';

  function normalizeText(value){ return String(value || '').trim().toLowerCase(); }
  function slugify(value){ return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''); }
  function ensureStoreShape(raw){
    const data = raw && typeof raw === 'object' ? raw : {};
    return {
      assignments: Array.isArray(data.assignments) ? data.assignments : [],
      submissions: Array.isArray(data.submissions) ? data.submissions : [],
      attempts: data.attempts && typeof data.attempts === 'object' ? data.attempts : {},
      students: Array.isArray(data.students) ? data.students : []
    };
  }
  async function readLocalStore(){
    try {
      const saved = localStorage.getItem(LOCAL_KEY);
      if (saved) return ensureStoreShape(JSON.parse(saved));
    } catch (error) {}
    if (isLocalPreview) {
      try {
        const res = await fetch('data/homework.json', { cache:'no-store' });
        if (!res.ok) throw new Error('Preview data is unavailable.');
        const data = await res.json();
        const safe = ensureStoreShape(data);
        try { localStorage.setItem(LOCAL_KEY, JSON.stringify(safe)); } catch (error) {}
        return safe;
      } catch (error) {}
    }
    return ensureStoreShape(null);
  }
  function writeLocalStore(store){
    const safe = ensureStoreShape(store);
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(safe)); } catch (error) {}
    return safe;
  }
  function nextStudentId(store){
    const nums = (store.students || []).map((row) => Number(String(row.studentId || '').replace(/\D+/g, ''))).filter((n) => Number.isFinite(n));
    return String((nums.length ? Math.max.apply(null, nums) : 0) + 1);
  }
  async function verifyLocalSecret(input, stored){
    const value = String(stored || '').trim();
    if (!value) return false;
    if (!value.startsWith('pbkdf2$')) return String(input || '').trim() === value;
    try {
      const parts = value.split('$');
      const enc = new TextEncoder();
      const key = await crypto.subtle.importKey('raw', enc.encode(String(input || '').trim()), { name: 'PBKDF2' }, false, ['deriveBits']);
      const salt = parts[2].match(/.{1,2}/g).map((hex) => parseInt(hex, 16));
      const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new Uint8Array(salt), iterations: Number(parts[1] || 120000) }, key, 256);
      const hex = Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, '0')).join('');
      return hex === parts[3];
    } catch (error) { return false; }
  }

  function nextStudentPin(store){
    const pins = new Set((store.students || []).map((row) => String(row.pin || '').trim()));
    for (let i = 1234; i <= 9999; i += 1) {
      const pin = String(i);
      if (!pins.has(pin)) return pin;
    }
    return String(Math.floor(1000 + Math.random() * 9000));
  }
  async function findStudent(store, studentId, pin){
    const rows = Array.isArray(store.students) ? store.students : [];
    for (const row of rows) {
      if (String(row.studentId || '').trim() !== String(studentId || '').trim()) continue;
      if (await verifyLocalSecret(pin, row.pin)) return row;
    }
    return null;
  }
  function identityFromStudent(student){
    return {
      name: student.name,
      studentId: student.studentId,
      grade: String(student.grade || '').trim().toUpperCase(),
      className: String(student.className || student.class || '').trim(),
      pin: String(student.pin || '').trim(),
      identityKey: [String(student.grade || '').trim().toUpperCase(), slugify(student.className || student.class || ''), slugify(student.studentId || 'no-id'), slugify(student.name || '')].join('::')
    };
  }
  function attemptKey(identity, homeworkId){ return `${identity.identityKey}::${String(homeworkId || '').trim()}`; }
  function publicAssignment(hw, extra){
    const out = Object.assign({}, hw || {}, extra || {});
    delete out.password;
    return out;
  }
  function canAccess(hw, identity){
    if (normalizeText(hw.grade) !== normalizeText(identity.grade)) return false;
    if (!Array.isArray(hw.classes) || !hw.classes.length) return true;
    return hw.classes.some((name) => normalizeText(name) === normalizeText(identity.className));
  }
  function answerMatches(a, b){ return normalizeText(a) === normalizeText(b); }
  function decodeHtml(value){ const box = document.createElement('textarea'); box.innerHTML = String(value || ''); return box.value; }
  async function localApi(action, options){
    const payload = options && options.body ? JSON.parse(options.body || '{}') : {};
    const store = await readLocalStore();

    if (action === 'identify-student') {
      const student = await findStudent(store, payload.studentId, payload.pin);
      if (!student) throw new Error('Student ID or PIN is not correct');
      return { ok:true, student };
    }

    if (action === 'available') {
      const student = await findStudent(store, payload.identity && payload.identity.studentId, payload.identity && payload.identity.pin);
      if (!student) throw new Error('Student ID or PIN is not correct');
      const identity = identityFromStudent(student);
      const rows = (store.assignments || []).filter((hw) => canAccess(hw, identity)).map((hw) => {
        const rec = store.attempts[attemptKey(identity, hw.id)] || { count:0, sessions:[] };
        const triesUsed = Number(rec.count || 0) || 0;
        const tryLimit = Number(hw.tryLimit || 0) || 0;
        return publicAssignment(hw, { triesUsed, blocked: tryLimit > 0 ? triesUsed >= tryLimit : false, remainingTries: tryLimit > 0 ? Math.max(0, tryLimit - triesUsed) : null });
      });
      return { ok:true, rows };
    }

    if (action === 'start') {
      const student = await findStudent(store, payload.identity && payload.identity.studentId, payload.identity && payload.identity.pin);
      if (!student) throw new Error('Student ID or PIN is not correct');
      const identity = identityFromStudent(student);
      const hw = (store.assignments || []).find((item) => String(item.id || '') === String(payload.homeworkId || '').trim());
      if (!hw) throw new Error('Homework was not found');
      if (!canAccess(hw, identity)) throw new Error('This homework is not available for this student');
      if (hw.usePassword && !(await verifyLocalSecret(payload.password, hw.password))) throw new Error('Wrong password');
      const key = attemptKey(identity, hw.id);
      const rec = store.attempts[key] && typeof store.attempts[key] === 'object' ? store.attempts[key] : { count:0, sessions:[] };
      const tryLimit = Number(hw.tryLimit || 0) || 0;
      if (tryLimit > 0 && Number(rec.count || 0) >= tryLimit) throw new Error('No tries left for this homework');
      const token = `HWS-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      rec.count = (Number(rec.count || 0) || 0) + 1;
      rec.sessions = Array.isArray(rec.sessions) ? rec.sessions : [];
      rec.sessions.unshift({ token, startedAt:new Date().toISOString(), submittedAt:'', submissionId:'' });
      store.attempts[key] = rec;
      writeLocalStore(store);
      return { ok:true, token, triesUsed: rec.count, tryLimit, assignment: publicAssignment(hw) };
    }

    if (action === 'submit') {
      const student = await findStudent(store, payload.identity && payload.identity.studentId, payload.identity && payload.identity.pin);
      if (!student) throw new Error('Student ID or PIN is not correct');
      const identity = identityFromStudent(student);
      const hw = (store.assignments || []).find((item) => String(item.id || '') === String(payload.homeworkId || '').trim());
      if (!hw) throw new Error('Homework was not found');
      const key = attemptKey(identity, hw.id);
      const rec = store.attempts[key] && typeof store.attempts[key] === 'object' ? store.attempts[key] : { count:0, sessions:[] };
      const token = String(payload.token || '').trim();
      const session = (rec.sessions || []).find((row) => String(row.token || '') === token);
      if (!session) throw new Error('This homework session is not valid');
      const answersIn = Array.isArray(payload.answers) ? payload.answers : [];
      const mapped = {};
      answersIn.forEach((item) => { mapped[Number(item && item.index)] = item || {}; });
      const answers = (hw.questions || []).map((question, index) => {
        const input = mapped[index] || {};
        const chosen = String(input.chosen || '').trim();
        const expected = String(question.answer || '').trim();
        return {
          index,
          questionText: question.text,
          chosen,
          correct: !!chosen && answerMatches(chosen, expected),
          expected,
          timedOut: !!input.timedOut,
          answeredAt: String(input.answeredAt || new Date().toISOString())
        };
      });
      const score = answers.filter((row) => row.correct).length;
      const questionCount = (hw.questions || []).length;
      const percent = questionCount ? Math.round((score / questionCount) * 100) : 0;
      const wrongAnswers = answers.filter((row) => !row.correct).map((row) => ({ index:row.index, questionText:row.questionText, chosen:row.chosen, expected:row.expected, answeredAt:row.answeredAt, timedOut:!!row.timedOut }));
      const submissionId = `HWR-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      session.submittedAt = new Date().toISOString();
      session.submissionId = submissionId;
      const submission = {
        id: submissionId,
        homeworkId: hw.id,
        homeworkTitle: hw.title,
        date: hw.date,
        studentName: identity.name,
        studentId: identity.studentId,
        className: identity.className,
        grade: identity.grade,
        identity,
        token,
        score,
        percent,
        questionCount,
        triesUsed: Number(rec.count || 0) || 0,
        wrongAnswersCount: wrongAnswers.length,
        wrongAnswers,
        answers,
        questions: hw.questions || [],
        submittedAt: session.submittedAt,
        timeUp: !!payload.timeUp,
        timerMinutes: Number(hw.timerMinutes || 0) || 0,
        usedTimer: !!hw.useTimer
      };
      store.submissions = Array.isArray(store.submissions) ? store.submissions : [];
      store.submissions.unshift(submission);
      writeLocalStore(store);
      return { ok:true, submission, result:{ score, percent, questionCount, wrongAnswersCount: wrongAnswers.length } };
    }

    throw new Error('Could not complete request.');
  }

  function updateLocalModeUi(force){
    const note = $('homeworkLocalModeNote');
    const card = $('homeworkRegisterCard');
    const toggle = $('toggleHomeworkRegisterBtn');
    if (!note || !card) return;
    const show = !!force || isLocalPreview;
    note.classList.toggle('hidden', !show);
    if (toggle) toggle.classList.toggle('hidden', !show);
    if (!show) {
      card.classList.add('hidden');
      card.dataset.expanded = '0';
    }
    if (toggle && !toggle.dataset.boundLocalRegister) {
      toggle.dataset.boundLocalRegister = '1';
      toggle.addEventListener('click', function(){
        const createBtn = $('createHomeworkStudentBtn');
        const expanded = card.dataset.expanded === '1';
        card.dataset.expanded = expanded ? '0' : '1';
        if (createBtn) createBtn.classList.toggle('hidden', expanded);
        card.classList.toggle('hidden', expanded);
        toggle.textContent = expanded ? 'Show Local Registration' : 'Hide Local Registration';
      });
    }
  }

  async function api(action, options){
    const suffix = action ? `?action=${encodeURIComponent(action)}` : '';
    try {
      const res = await fetch(API + suffix, Object.assign({ headers:{ 'Content-Type':'application/json' }, cache:'no-store' }, options || {}));
      const data = await res.json().catch(()=>({ ok:false, error:'Could not complete request.' }));
      if (!res.ok || !data.ok) throw new Error(data.error || 'Could not complete request.');
      return data;
    } catch (error) {
      updateLocalModeUi(true);
      return localApi(action, options || {});
    }
  }

  function setStatus(msg){
    $('homeworkStatus').textContent = msg || '';
  }

  async function createLocalStudent(){
    const name = String($('homeworkRegisterName')?.value || '').trim();
    const grade = String($('homeworkRegisterGrade')?.value || 'KG1').trim().toUpperCase();
    const className = String($('homeworkRegisterClass')?.value || '').trim() || 'Class';
    const customPin = String($('homeworkRegisterPin')?.value || '').trim();
    const status = $('homeworkRegisterStatus');
    if (!name) { if (status) status.textContent = 'Please enter the student name.'; return; }
    const store = await readLocalStore();
    const studentId = nextStudentId(store);
    const pin = customPin || nextStudentPin(store);
    store.students = Array.isArray(store.students) ? store.students : [];
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(String(pin)), { name: 'PBKDF2' }, false, ['deriveBits']);
    const saltBytes = crypto.getRandomValues(new Uint8Array(16));
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations: 120000 }, key, 256);
    const saltHex = Array.from(saltBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    const digestHex = Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, '0')).join('');
    const pinHash = `pbkdf2$120000$${saltHex}$${digestHex}`;
    store.students.push({
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      studentId,
      pin: pinHash,
      name,
      grade,
      className,
      active: true
    });
    writeLocalStore(store);
    if ($('homeworkStudentId')) $('homeworkStudentId').value = studentId;
    if ($('homeworkStudentPin')) $('homeworkStudentPin').value = pin;
    if (status) status.textContent = `Created local student ${name}. ID: ${studentId} | PIN: ${pin}`;
    setStatus('Local student created. You can verify and open homework now.');
  }

  function studentIdentity(){
    const studentId = String($('homeworkStudentId')?.value || '').trim();
    const pin = String($('homeworkStudentPin')?.value || '').trim();
    if (!studentId) throw new Error('Please enter student ID.');
    if (!pin) throw new Error('Please enter PIN.');
    const verified = state && state.identity ? state.identity : null;
    if (verified && verified.studentId === studentId && verified.pin === pin) return verified;
    return { studentId, pin };
  }

  async function verifyStudent(showStatus){
    const studentId = String($('homeworkStudentId')?.value || '').trim();
    const pin = String($('homeworkStudentPin')?.value || '').trim();
    if (!studentId || !pin) {
      if (showStatus) setStatus('Please enter student ID and PIN first.');
      throw new Error('Please enter student ID and PIN first.');
    }
    const data = await api('identify-student', { method:'POST', body: JSON.stringify({ studentId, pin }) });
    state = state || {};
    state.identity = Object.assign({}, data.student || {}, { pin });
    const box = $('homeworkVerifiedBox');
    if (box) box.textContent = `Verified: ${data.student.name} - ${data.student.grade} / ${data.student.className}`;
    if (showStatus) setStatus('Student verified.');
    return state.identity;
  }

  async function renderAssignments(){
    try {
      const sid = String($('homeworkStudentId')?.value || '').trim();
      const pin = String($('homeworkStudentPin')?.value || '').trim();
      if (!sid || !pin) {
        availableRows = [];
        $('homeworkAvailableList').innerHTML = '';
        setStatus('Please enter student ID and PIN first.');
        return;
      }
      const identity = await verifyStudent(false);
      const data = await api('available', { method:'POST', body: JSON.stringify({ identity }) });
      availableRows = Array.isArray(data.rows) ? data.rows : [];
      $('homeworkAvailableList').innerHTML = availableRows.map((hw) => {
        const used = Number(hw.triesUsed || 0) || 0;
        const limit = Number(hw.tryLimit || 0) || 0;
        const blocked = !!hw.blocked;
        const tryText = limit > 0 ? `${used} / ${limit}` : `${used}`;
        return `<div class="stored-question homework-card-item"><h4>${esc(hw.title)}</h4><p><strong>Date:</strong> ${esc(hw.date || '-')}</p><p><strong>Classes:</strong> ${esc((hw.classes || []).join(', ') || 'All')}</p><p><strong>Questions:</strong> ${esc(String((hw.questions || []).length))}</p><p><strong>Timer:</strong> ${hw.useTimer ? esc(String(hw.timerMinutes) + ' min') : 'No'}</p><p><strong>Password:</strong> ${hw.usePassword ? 'Required' : 'No'}</p>${hw.usePassword ? `<label class="homework-password-row"><span>Homework password</span><input type="password" class="homework-password-input" data-homework-password-for="${esc(hw.id)}" placeholder="Enter homework password"></label>` : ''}<p><strong>Tries used:</strong> ${esc(tryText)}${limit === 0 ? ' <span class="muted-note">(no limit)</span>' : ''}</p><div class="action-row"><button class="main-btn homework-open-btn" data-id="${esc(hw.id)}" ${blocked ? 'disabled' : ''}>${blocked ? 'No tries left' : 'Start homework'}</button></div></div>`;
      }).join('') || '<div class="muted-note">No homework available for this grade and class.</div>';
      setStatus(availableRows.length ? `${availableRows.length} homework item(s) found.` : 'No homework found.');
    } catch (error) {
      availableRows = [];
      $('homeworkAvailableList').innerHTML = '';
      setStatus(error.message || 'Could not load homework.');
    }
  }

  function updateQuizHead(){
    $('homeworkStudentPreview').textContent = `${state.identity.name} (${state.identity.studentId})`;
    $('homeworkTitlePreview').textContent = state.assignment.title;
    $('homeworkQuestionProgress').textContent = `${state.index + 1} / ${state.assignment.questions.length}`;
    $('homeworkAnsweredValue').textContent = String(state.answers.filter((a) => a && a.chosen).length);
    $('homeworkClassBadge').textContent = state.identity.className;
    $('homeworkDateBadge').textContent = state.assignment.date || '-';
    $('homeworkTimerValue').textContent = state.timeLeft == null ? 'Off' : String(state.timeLeft);
  }

  function resolveQuestionImage(image){
    const value = String(image || '').trim();
    if (!value) return '';
    if (/^(https?:)?\/\//i.test(value) || value.startsWith('data:') || value.startsWith('/')) return value;

    const clean = value.replace(/^\.\//, '').replace(/^\/+/, '');
    if (/^assets\//i.test(clean)) return '/' + clean;
    if (/^svg\//i.test(clean)) return '/' + clean;
    if (/^(quiz-bulk|img|icons)\//i.test(clean)) return '/assets/' + clean;
    if (/^[^\/]+\.(png|jpe?g|gif|webp|svg)$/i.test(clean)) return '/assets/quiz-bulk/' + clean;

    return '/assets/' + clean;
  }

  function renderQuestion(){
    const q = state.assignment.questions[state.index];
    if (!q) return finishHomework(false);
    updateQuizHead();
    $('homeworkQuestionText').textContent = q.text || 'Question';
    const imageWrap = $('homeworkQuestionMediaWrap');
    const imageEl = $('homeworkQuestionImage');
    const imageSrc = resolveQuestionImage(q.image);
    if (imageWrap && imageEl) {
      if (imageSrc) {
        imageEl.onerror = function(){ this.removeAttribute('src'); if (imageWrap) imageWrap.classList.add('hidden'); };
        imageEl.src = imageSrc;
        imageEl.alt = q.text || 'Question image';
        imageWrap.classList.remove('hidden');
      } else {
        imageEl.removeAttribute('src');
        imageWrap.classList.add('hidden');
      }
    }
    $('homeworkOptionsWrap').innerHTML = (q.options || []).map((opt, idx) => `<button type="button" class="option-btn" data-option="${idx}" data-answer="${esc(opt)}">${esc(opt)}</button>`).join('');
    document.querySelectorAll('#homeworkOptionsWrap .option-btn').forEach((btn) => {
      btn.addEventListener('click', function(){
        if (state.answers[state.index]) return;
        chooseAnswer(decodeHtml(this.getAttribute('data-answer') || this.textContent || ''));
      });
    });
  }

  function chooseAnswer(choice){
    const q = state.assignment.questions[state.index];
    state.answers[state.index] = {
      index: state.index,
      questionText: q.text,
      chosen: String(choice || '').trim(),
      answeredAt: new Date().toISOString()
    };
    document.querySelectorAll('#homeworkOptionsWrap .option-btn').forEach((btn) => {
      btn.disabled = true;
      btn.classList.add(String(btn.textContent || '').trim() === String(choice || '').trim() ? 'selected' : 'disabled');
    });
    updateQuizHead();
    window.clearTimeout(state.autoNextTimer);
    state.autoNextTimer = window.setTimeout(() => {
      if (!state || state.submitting) return;
      if (state.index >= state.assignment.questions.length - 1) finishHomework(false);
      else nextQuestion(true);
    }, 650);
  }

  function nextQuestion(skipPrompt){
    if (!state.answers[state.index]) {
      if (!skipPrompt) alert('Please choose an answer first.');
      return;
    }
    window.clearTimeout(state.autoNextTimer);
    state.index += 1;
    if (state.index >= state.assignment.questions.length) return finishHomework(false);
    renderQuestion();
  }

  function stopTimer(){
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    if (state && state.autoNextTimer) {
      clearTimeout(state.autoNextTimer);
      state.autoNextTimer = null;
    }
  }

  function startTimer(){
    stopTimer();
    if (!state.assignment.useTimer || !state.timeLeft) {
      state.timeLeft = null;
      updateQuizHead();
      return;
    }
    updateQuizHead();
    timer = setInterval(() => {
      state.timeLeft = Math.max(0, Number(state.timeLeft || 0) - 1);
      updateQuizHead();
      if (state.timeLeft <= 0) {
        stopTimer();
        finishHomework(true);
      }
    }, 1000);
  }

  async function finishHomework(timeUp){
    if (!state || state.submitting) return;
    state.submitting = true;
    stopTimer();
    try {
      const submitData = await api('submit', {
        method:'POST',
        body: JSON.stringify({
          identity: state.identity,
          homeworkId: state.assignment.id,
          token: state.token,
          answers: state.answers,
          timeUp: !!timeUp
        })
      });

      if (studentCloud && typeof studentCloud.submitResult === 'function') {
        try {
          await studentCloud.submitResult({
            identity: state.identity,
            quizKey: (studentCloud && typeof studentCloud.buildQuizKey === 'function') ? studentCloud.buildQuizKey({ grade: String((state.assignment.grade||'HOMEWORK')).toUpperCase(), count: Number((state.assignment.questions||[]).length||0), label: 'homework-' + String(state.assignment.id||submitData.submission.id||'task') }) : `HOMEWORK|${state.assignment.id}|${submitData.submission.id}`,
            result: submitData.result,
            state: {
              completed: true,
              currentIndex: state.index,
              selectedCount: state.assignment.questions.length,
              selectedLevelLabel: state.assignment.title,
              questions: state.assignment.questions,
              answers: submitData.result.answers
            }
          });
        } catch (error) {
          setStatus('Homework submitted locally, but cloud sync failed.');
        }
      }

      $('homeworkQuizSection').classList.add('hidden');
      $('homeworkDoneSection').classList.remove('hidden');
      $('homeworkDoneText').textContent = timeUp
        ? `Homework submitted automatically when time ended. Try ${submitData.submission.triesUsed} saved in reports.`
        : `Homework submitted successfully. Try ${submitData.submission.triesUsed} saved in reports.`;
      await renderAssignments();
    } catch (error) {
      setStatus(error.message || 'Could not submit homework.');
    } finally {
      state.submitting = false;
    }
  }

  async function startHomework(id){
    try {
      const identity = state && state.identity ? state.identity : await verifyStudent(false);
      const assignment = availableRows.find((row) => row.id === id);
      const passwordField = document.querySelector(`[data-homework-password-for="${CSS.escape(String(id || ''))}"]`);
      const password = assignment && assignment.usePassword ? String(passwordField?.value || '').trim() : '';
      if (assignment && assignment.usePassword && !password) throw new Error('Please enter the homework password.');
      const data = await api('start', {
        method:'POST',
        body: JSON.stringify({
          identity,
          homeworkId: id,
          password: password || ''
        })
      });
      state = {
        identity,
        assignment: data.assignment,
        token: data.token,
        index: 0,
        answers: [],
        timeLeft: data.assignment.useTimer ? Number(data.assignment.timerMinutes || 0) * 60 : null,
        submitting: false,
        autoNextTimer: null
      };
      $('homeworkStartCard').classList.add('hidden');
      $('homeworkDoneSection').classList.add('hidden');
      $('homeworkQuizSection').classList.remove('hidden');
      setStatus('');
      renderQuestion();
      startTimer();
    } catch (error) {
      setStatus(error.message || 'Could not start homework.');
    }
  }

  updateLocalModeUi(false);
  $('loadHomeworkBtn')?.addEventListener('click', renderAssignments);
  $('createHomeworkStudentBtn')?.addEventListener('click', createLocalStudent);
  $('homeworkNextBtn')?.addEventListener('click', nextQuestion);
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.homework-open-btn');
    if (btn) startHomework(btn.dataset.id);
  });
})();
