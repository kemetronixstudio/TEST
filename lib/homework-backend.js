const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { kvGetJson, kvSetJson, getKvConfig } = require('./kv-store');

const STORAGE_KEY = 'kgEnglishHomeworkV1';
const RUNTIME_DATA_DIR = process.env.RUNTIME_DATA_DIR || (process.env.VERCEL ? path.join('/tmp', 'kg-quiz-runtime') : path.join(process.cwd(), 'data'));
const FILE_PATH = process.env.HOMEWORK_DATA_PATH || path.join(RUNTIME_DATA_DIR, 'homework.json');
const ENABLE_DIRECT_REDIS_TCP = ['1','true','yes'].includes(String(process.env.ENABLE_DIRECT_REDIS_TCP || '').trim().toLowerCase());
function clampText(value, maxLen) { return String(value || '').trim().slice(0, maxLen); }
function hashSecret(secret, salt) {
  const safeSalt = salt || crypto.randomBytes(16).toString('hex');
  const iterations = 120000;
  const digest = crypto.pbkdf2Sync(String(secret || ''), safeSalt, iterations, 32, 'sha256').toString('hex');
  return `pbkdf2$${iterations}$${safeSalt}$${digest}`;
}
function verifySecret(secret, stored) {
  const value = String(stored || '').trim();
  if (!value) return false;
  if (!value.startsWith('pbkdf2$')) return String(secret || '') === value;
  const parts = value.split('$');
  if (parts.length !== 4) return false;
  try {
    const next = crypto.pbkdf2Sync(String(secret || ''), parts[2], Number(parts[1] || 120000), 32, 'sha256').toString('hex');
    const a = Buffer.from(parts[3], 'hex');
    const b = Buffer.from(next, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch (error) {
    return false;
  }
}

function baseStore(){
  return { assignments: [], submissions: [], attempts: {}, students: [] };
}

function slugify(value){
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function normalizeText(value){
  return String(value || '').trim().toLowerCase();
}

function normalizeAnswer(value){
  return String(value || '').trim().toLowerCase();
}

function sanitizeStudent(input){
  const raw = input || {};
  const name = String(raw.name || '').trim();
  const grade = String(raw.grade || '').trim().toUpperCase();
  const className = String(raw.className || raw.class || '').trim();
  const studentId = String(raw.studentId || '').trim();
  const pin = String(raw.pin || '').trim();
  if (!name) throw new Error('Student name is required');
  if (!grade) throw new Error('Student grade is required');
  if (!className) throw new Error('Student class is required');
  if (!studentId) throw new Error('Student ID is required');
  if (!pin) throw new Error('PIN is required');
  return {
    id: String(raw.id || `STD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    name,
    grade,
    className,
    studentId,
    pin,
    active: raw.active !== false,
    createdAt: String(raw.createdAt || new Date().toISOString())
  };
}

function publicStudent(input){
  const row = sanitizeStudent(input);
  const secure = String(row.pin || '').startsWith('pbkdf2$');
  return {
    id: row.id,
    name: row.name,
    grade: row.grade,
    className: row.className,
    studentId: row.studentId,
    pin: secure ? 'Stored securely' : row.pin,
    pinLabel: secure ? 'Stored securely' : row.pin,
    active: row.active,
    createdAt: row.createdAt
  };
}

function nextStudentNumber(store){
  const nums = (store.students || []).map((s) => Number(String(s.studentId || '').replace(/\D+/g,''))).filter((n) => Number.isFinite(n));
  const max = nums.length ? Math.max(...nums) : 1000;
  return String(max + 1);
}

function nextStudentPin(){
  return String(Math.floor(1000 + Math.random() * 9000));
}

async function findStudentByCredentials(store, studentId, pin){
  const sid = String(studentId || '').trim();
  const pinValue = String(pin || '').trim();
  for (const item of (store.students || [])) {
    if (String(item.studentId || '').trim() !== sid || item.active === false) continue;
    if (verifySecret(pinValue, String(item.pin || '').trim())) return item;
  }
  return null;
}

async function resolveVerifiedIdentity(store, identityInput){
  const raw = identityInput || {};
  const student = await findStudentByCredentials(store, raw.studentId || raw.id, raw.pin);
  if (!student) throw new Error('Student ID or PIN is not correct');
  return sanitizeIdentity({
    name: student.name,
    studentId: student.studentId,
    grade: student.grade,
    className: student.className
  });
}

async function identifyStudent(payload){
  const store = await readStore();
  const student = await findStudentByCredentials(store, payload && payload.studentId, payload && payload.pin);
  if (!student) throw new Error('Student ID or PIN is not correct');
  return { ok:true, student: publicStudent(student) };
}

async function listStudents(filters){
  const store = await readStore();
  const q = normalizeText(filters && filters.q || '');
  const rows = (store.students || [])
    .map(publicStudent)
    .filter((row) => !q || [row.name, row.studentId, row.grade, row.className].some((v) => normalizeText(v).includes(q)))
    .sort((a,b) => String(a.studentId).localeCompare(String(b.studentId)));
  return { ok:true, rows };
}

async function saveStudent(payload){
  const store = await readStore();
  const existingId = String(payload && payload.id || '').trim();
  store.students = Array.isArray(store.students) ? store.students : [];
  const idx = store.students.findIndex((item) => String(item.id||'') === existingId);
  const existing = idx >= 0 ? store.students[idx] : null;
  let rawPin = String(payload && payload.pin || '').trim();
  if (!rawPin && existing) rawPin = String(existing.pin || '').trim();
  if (!rawPin) rawPin = nextStudentPin();
  const plainPin = rawPin.startsWith('pbkdf2$') ? '' : rawPin;
  const row = sanitizeStudent({
    ...payload,
    studentId: String(payload && payload.studentId || '').trim() || (existing && existing.studentId) || nextStudentNumber(store),
    pin: rawPin.startsWith('pbkdf2$') ? rawPin : hashSecret(rawPin)
  });
  const dup = (store.students || []).find((item) => item.id !== existingId && String(item.studentId||'').trim() === row.studentId);
  if (dup) throw new Error('Student ID already exists');
  if (idx >= 0) store.students[idx] = { ...store.students[idx], ...row, id: existingId || row.id };
  else store.students.unshift(row);
  await writeStore(store);
  return { ok:true, student: publicStudent(idx >= 0 ? store.students[idx] : row), rows: store.students.map(publicStudent), plainPin: plainPin || undefined };
}

async function deleteStudent(payload){
  const store = await readStore();
  const id = String(payload && (payload.id || payload.studentId) || '').trim();
  if (!id) throw new Error('Student id is required');
  store.students = (store.students || []).filter((item) => String(item.id||'') !== id && String(item.studentId||'') !== id);
  await writeStore(store);
  return { ok:true, rows: store.students.map(publicStudent) };
}

function coerceStore(raw){
  if (Array.isArray(raw)) {
    return { assignments: raw, submissions: [], attempts: {}, students: [] };
  }
  if (!raw || typeof raw !== 'object') return baseStore();
  return {
    assignments: Array.isArray(raw.assignments) ? raw.assignments : [],
    submissions: Array.isArray(raw.submissions) ? raw.submissions : [],
    attempts: raw.attempts && typeof raw.attempts === 'object' ? raw.attempts : {},
    students: Array.isArray(raw.students) ? raw.students : []
  };
}

function createRedisSocket(){ return null; }
function encodeRedisCommand(){ return Buffer.alloc(0); }
function parseRedisReply(){ return null; }
async function redisCommand(){ return null; }
async function redisGetJson(){ return null; }
async function redisSetJson(){ return null; }

function readFileJson() {
  try {
    if (!fs.existsSync(FILE_PATH)) return null;
    const raw = fs.readFileSync(FILE_PATH, 'utf8');
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function writeFileJson(value) {
  fs.mkdirSync(path.dirname(FILE_PATH), { recursive: true });
  fs.writeFileSync(FILE_PATH, JSON.stringify(value, null, 2), 'utf8');
  return true;
}

function getMemoryStore() {
  globalThis.__KG_HOMEWORK_MEMORY__ = globalThis.__KG_HOMEWORK_MEMORY__ || baseStore();
  return globalThis.__KG_HOMEWORK_MEMORY__;
}

function setMemoryStore(value) {
  globalThis.__KG_HOMEWORK_MEMORY__ = coerceStore(value);
  return true;
}

async function readStore(){
  let raw;
  try { raw = await kvGetJson(STORAGE_KEY, undefined); } catch (error) { raw = undefined; }
  if (raw == null && !process.env.VERCEL && !getKvConfig()) raw = readFileJson();
  if (raw == null) raw = getMemoryStore();
  return coerceStore(raw);
}

async function writeStore(store){
  const safe = coerceStore(store);
  try {
    const done = await kvSetJson(STORAGE_KEY, safe);
    if (done) return safe;
  } catch (error) {}
  if (!process.env.VERCEL && !getKvConfig()) {
    try {
      writeFileJson(safe);
      return safe;
    } catch (error) {}
  }
  setMemoryStore(safe);
  if (process.env.VERCEL && getKvConfig()) {
    const writeError = new Error('Persistent KV storage write failed. Check Vercel KV environment variables.');
    writeError.code = 'KV_WRITE_FAILED';
    throw writeError;
  }
  return safe;
}

function sanitizeQuestion(q){
  if (!q || typeof q !== 'object') return null;
  const text = clampText(q.text || '', 200);
  const answer = clampText(q.answer || '', 120);
  const options = Array.isArray(q.options) ? q.options.map((v) => clampText(v || '', 120)).filter(Boolean) : [];
  if (!text || !answer || options.length < 2) return null;
  return {
    text,
    options,
    answer,
    skill: clampText(q.skill || 'Homework', 80),
    type: clampText(q.type || 'Question', 40),
    image: q.image || null
  };
}

function sanitizeAssignment(row){
  const classes = Array.isArray(row.classes) ? row.classes.map((v) => String(v || '').trim()).filter(Boolean) : [];
  const questions = Array.isArray(row.questions) ? row.questions.map(sanitizeQuestion).filter(Boolean) : [];
  return {
    id: String(row.id || ('HW-' + Date.now())).trim(),
    title: clampText(row.title || '', 160),
    grade: clampText(row.grade || '', 30).toUpperCase(),
    classes,
    date: clampText(row.date || '', 60),
    mode: clampText(row.mode || 'select', 30),
    questions,
    useTimer: !!row.useTimer,
    timerMinutes: row.useTimer ? Math.max(1, Number(row.timerMinutes || 0) || 0) : 0,
    usePassword: !!row.usePassword,
    password: row.usePassword ? (String(row.password || '').trim().startsWith('pbkdf2$') ? String(row.password || '').trim() : hashSecret(clampText(row.password || '', 60))) : '',
    tryLimit: Math.max(0, Math.min(5, Number(row.tryLimit || 0) || 0)),
    createdAt: String(row.createdAt || new Date().toISOString())
  };
}

function sanitizeIdentity(input){
  const raw = input || {};
  const name = clampText(raw.name || raw.studentName || '', 80);
  const studentId = clampText(raw.studentId || '', 60);
  const grade = clampText(raw.grade || '', 30).toUpperCase();
  const className = clampText(raw.className || raw.class || '', 80);
  if (!name) throw new Error('Student name is required');
  if (!grade) throw new Error('Student grade is required');
  if (!className) throw new Error('Student class is required');
  return {
    name,
    studentId,
    grade,
    className,
    identityKey: [grade, slugify(className), slugify(studentId || 'no-id'), slugify(name)].join('::')
  };
}

function attemptKey(identity, homeworkId){
  return `${identity.identityKey}::${String(homeworkId || '').trim()}`;
}

function publicAssignment(item, extra){
  const row = sanitizeAssignment(item || {});
  const out = Object.assign({}, row, extra || {});
  delete out.password;
  return out;
}

function findAssignment(store, homeworkId){
  const id = String(homeworkId || '').trim();
  const row = (store.assignments || []).find((item) => String(item.id || '') === id);
  if (!row) throw new Error('Homework was not found');
  return sanitizeAssignment(row);
}

function studentCanAccess(assignment, identity){
  if (normalizeText(assignment.grade) !== normalizeText(identity.grade)) return false;
  if (!Array.isArray(assignment.classes) || !assignment.classes.length) return true;
  return assignment.classes.some((className) => normalizeText(className) === normalizeText(identity.className));
}

function ensureStudentAccess(assignment, identity){
  if (!studentCanAccess(assignment, identity)) throw new Error('This homework is not available for this student');
}

function getAttemptRecord(store, identity, homeworkId){
  const key = attemptKey(identity, homeworkId);
  return store.attempts[key] && typeof store.attempts[key] === 'object'
    ? store.attempts[key]
    : { count: 0, sessions: [] };
}

function setAttemptRecord(store, identity, homeworkId, record){
  store.attempts[attemptKey(identity, homeworkId)] = {
    count: Math.max(0, Number(record && record.count || 0) || 0),
    sessions: Array.isArray(record && record.sessions) ? record.sessions : []
  };
}

function checkTryLimit(assignment, attemptRecord){
  const tryLimit = Math.max(0, Number(assignment.tryLimit || 0) || 0);
  if (tryLimit > 0 && Number(attemptRecord.count || 0) >= tryLimit) {
    throw new Error('No tries left for this homework');
  }
}

function buildSubmissionSummary(submission){
  return {
    id: submission.id,
    homeworkId: submission.homeworkId,
    homeworkTitle: submission.homeworkTitle,
    studentName: submission.studentName,
    studentId: submission.studentId,
    className: submission.className,
    grade: submission.grade,
    score: submission.score,
    percent: submission.percent,
    questionCount: submission.questionCount,
    wrongAnswersCount: submission.wrongAnswersCount,
    triesUsed: submission.triesUsed,
    submittedAt: submission.submittedAt,
    timeUp: !!submission.timeUp
  };
}

async function list(){
  const store = await readStore();
  return { ok:true, rows: (store.assignments || []).map((item) => publicAssignment(item)) };
}

async function save(row){
  const store = await readStore();
  const data = sanitizeAssignment(row || {});
  if (!data.title) throw new Error('Homework title is required');
  if (!data.grade) throw new Error('Homework grade is required');
  if (!data.date) throw new Error('Homework date is required');
  if (!data.questions.length) throw new Error('At least one homework question is required');
  store.assignments = (store.assignments || []).filter((item) => item.id !== data.id);
  store.assignments.unshift(data);
  await writeStore(store);
  return { ok:true, row: publicAssignment(data) };
}

async function remove(id){
  const key = String(id || '').trim();
  if (!key) throw new Error('Homework id is required');
  const store = await readStore();
  store.assignments = (store.assignments || []).filter((item) => item.id !== key);
  store.submissions = (store.submissions || []).filter((item) => item.homeworkId !== key);
  Object.keys(store.attempts || {}).forEach((attemptId) => {
    if (attemptId.endsWith(`::${key}`)) delete store.attempts[attemptId];
  });
  await writeStore(store);
  return { ok:true };
}

async function listForStudent(identityInput){
  const store = await readStore();
  const identity = await resolveVerifiedIdentity(store, identityInput);
  const rows = (store.assignments || [])
    .map((item) => sanitizeAssignment(item))
    .filter((assignment) => studentCanAccess(assignment, identity))
    .sort((a, b) => String(b.date || b.createdAt || '').localeCompare(String(a.date || a.createdAt || '')))
    .map((assignment) => {
      const attempts = getAttemptRecord(store, identity, assignment.id);
      const triesUsed = Number(attempts.count || 0) || 0;
      const tryLimit = Number(assignment.tryLimit || 0) || 0;
      return publicAssignment(assignment, {
        triesUsed,
        remainingTries: tryLimit > 0 ? Math.max(0, tryLimit - triesUsed) : null,
        blocked: tryLimit > 0 ? triesUsed >= tryLimit : false
      });
    });
  return { ok:true, rows };
}

async function start(payload){
  const store = await readStore();
  const identity = await resolveVerifiedIdentity(store, payload.identity || payload);
  const assignment = findAssignment(store, payload.homeworkId || payload.id);
  ensureStudentAccess(assignment, identity);
  if (assignment.usePassword) {
    const provided = String(payload.password || '').trim();
    if (!verifySecret(provided, String(assignment.password || ''))) throw new Error('Wrong password');
  }
  const attempts = getAttemptRecord(store, identity, assignment.id);
  checkTryLimit(assignment, attempts);
  const token = `HWS-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  attempts.count = (Number(attempts.count || 0) || 0) + 1;
  attempts.sessions = Array.isArray(attempts.sessions) ? attempts.sessions : [];
  attempts.sessions.unshift({ token, startedAt: new Date().toISOString(), submittedAt: '', submissionId: '' });
  attempts.sessions = attempts.sessions.slice(0, 20);
  setAttemptRecord(store, identity, assignment.id, attempts);
  await writeStore(store);
  return {
    ok:true,
    token,
    tryLimit: Number(assignment.tryLimit || 0) || 0,
    triesUsed: Number(attempts.count || 0) || 0,
    assignment: publicAssignment(assignment)
  };
}

async function submit(payload){
  const token = String(payload.token || '').trim();
  if (!token) throw new Error('Homework session token is required');
  const store = await readStore();
  const identity = await resolveVerifiedIdentity(store, payload.identity || payload);
  const assignment = findAssignment(store, payload.homeworkId || payload.id);
  ensureStudentAccess(assignment, identity);

  const attempts = getAttemptRecord(store, identity, assignment.id);
  const session = (attempts.sessions || []).find((item) => String(item.token || '') === token);
  if (!session) throw new Error('This homework session is not valid');
  if (session.submissionId) throw new Error('This homework session was already submitted');

  const rawAnswers = Array.isArray(payload.answers) ? payload.answers : [];
  const answerMap = {};
  rawAnswers.forEach((item) => {
    const index = Number(item && item.index);
    if (!Number.isFinite(index)) return;
    answerMap[index] = item || {};
  });

  const answers = assignment.questions.map((question, index) => {
    const input = answerMap[index] || {};
    const chosen = String(input.chosen != null ? input.chosen : '').trim();
    const expected = String(question.answer || '').trim();
    return {
      index,
      questionText: question.text,
      chosen,
      correct: normalizeAnswer(chosen) === normalizeAnswer(expected) && !!chosen,
      expected,
      timedOut: !!input.timedOut,
      answeredAt: String(input.answeredAt || new Date().toISOString())
    };
  });

  const score = answers.filter((item) => item.correct).length;
  const questionCount = assignment.questions.length;
  const percent = questionCount ? Math.round((score / questionCount) * 100) : 0;
  const wrongAnswers = answers.filter((item) => !item.correct).map((item) => ({
    index: item.index,
    questionText: item.questionText,
    chosen: item.chosen,
    expected: item.expected,
    answeredAt: item.answeredAt,
    timedOut: !!item.timedOut
  }));
  const submissionId = `HWR-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const submittedAt = new Date().toISOString();
  const submission = {
    id: submissionId,
    homeworkId: assignment.id,
    homeworkTitle: assignment.title,
    date: assignment.date,
    studentName: identity.name,
    studentId: identity.studentId,
    className: identity.className,
    grade: identity.grade,
    identity,
    token,
    score,
    percent,
    questionCount,
    triesUsed: Number(attempts.count || 0) || 0,
    wrongAnswersCount: wrongAnswers.length,
    wrongAnswers,
    answers,
    questions: assignment.questions,
    submittedAt,
    timeUp: !!payload.timeUp,
    timerMinutes: Number(assignment.timerMinutes || 0) || 0,
    usedTimer: !!assignment.useTimer
  };

  session.submissionId = submissionId;
  session.submittedAt = submittedAt;
  store.submissions = Array.isArray(store.submissions) ? store.submissions : [];
  store.submissions.unshift(submission);
  setAttemptRecord(store, identity, assignment.id, attempts);
  await writeStore(store);

  const result = {
    studentName: identity.name,
    studentId: identity.studentId,
    className: identity.className,
    grade: identity.grade,
    quizLevel: 'Homework',
    questionCount,
    score,
    percent,
    strengths: [],
    weaknesses: [],
    advice: 'Homework submitted.',
    remark: payload.timeUp ? 'Time Up' : 'Submitted',
    date: new Date(submittedAt).toLocaleDateString('en-GB'),
    lang: 'en',
    missedQuestions: wrongAnswers.map((item) => item.questionText),
    answers,
    questions: assignment.questions,
    homeworkId: assignment.id,
    homeworkTitle: assignment.title,
    completedAt: submittedAt
  };

  return { ok:true, submission: buildSubmissionSummary(submission), detail: submission, result };
}

function filterReports(rows, filters){
  const q = slugify((filters && filters.q) || '');
  const className = slugify((filters && filters.className) || '');
  const grade = slugify((filters && filters.grade) || '');
  const homeworkId = String((filters && filters.homeworkId) || '').trim();
  const fromDate = String((filters && filters.fromDate) || '').trim();
  const toDate = String((filters && filters.toDate) || '').trim();
  return rows.filter((row) => {
    if (className && slugify(row.className) !== className) return false;
    if (grade && slugify(row.grade) !== grade) return false;
    if (homeworkId && String(row.homeworkId || '') !== homeworkId) return false;
    const rowDate = String(row.submittedAt || row.date || '').slice(0, 10);
    if (fromDate && rowDate && rowDate < fromDate) return false;
    if (toDate && rowDate && rowDate > toDate) return false;
    if (!q) return true;
    return [row.studentName, row.studentId, row.className, row.grade, row.homeworkTitle, row.homeworkId].some((value) => slugify(value).includes(q));
  });
}


async function analytics(filters){
  const store = await readStore();
  const submissions = filterReports(Array.isArray(store.submissions) ? store.submissions : [], filters);
  const assignments = Array.isArray(store.assignments) ? store.assignments : [];
  const totalSubmissions = submissions.length;
  const studentSet = new Set();
  const classMap = {};
  const dailyMap = {};
  const homeworkMap = {};
  submissions.forEach((row) => {
    const studentKey = slugify(row.studentId || row.studentName || row.identity && row.identity.identityKey || row.id);
    if (studentKey) studentSet.add(studentKey);
    const classKey = `${row.grade || '-'}||${row.className || '-'}`;
    classMap[classKey] = classMap[classKey] || { className: row.className || '-', grade: row.grade || '-', submissions: 0, totalPercent: 0, students: new Set() };
    classMap[classKey].submissions += 1;
    classMap[classKey].totalPercent += Number(row.percent || 0) || 0;
    if (studentKey) classMap[classKey].students.add(studentKey);
    const dayKey = String(row.submittedAt || row.date || '').slice(0, 10) || 'unknown';
    dailyMap[dayKey] = dailyMap[dayKey] || { date: dayKey, submissions: 0, averagePercent: 0, totalPercent: 0 };
    dailyMap[dayKey].submissions += 1;
    dailyMap[dayKey].totalPercent += Number(row.percent || 0) || 0;
    const hwKey = String(row.homeworkId || row.homeworkTitle || 'unknown');
    homeworkMap[hwKey] = homeworkMap[hwKey] || { homeworkId: row.homeworkId || '', homeworkTitle: row.homeworkTitle || 'Homework', submissions: 0, totalPercent: 0, averagePercent: 0, averageWrong: 0, totalWrong: 0 };
    homeworkMap[hwKey].submissions += 1;
    homeworkMap[hwKey].totalPercent += Number(row.percent || 0) || 0;
    homeworkMap[hwKey].totalWrong += Number(row.wrongAnswersCount || 0) || 0;
  });
  const classBreakdown = Object.values(classMap).map((item) => ({ className: item.className, grade: item.grade, submissions: item.submissions, students: item.students.size, averagePercent: item.submissions ? Math.round(item.totalPercent / item.submissions) : 0 })).sort((a, b) => b.averagePercent - a.averagePercent || a.className.localeCompare(b.className));
  const dailyTrend = Object.values(dailyMap).map((item) => ({ date: item.date, submissions: item.submissions, averagePercent: item.submissions ? Math.round(item.totalPercent / item.submissions) : 0 })).sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(-14);
  const topHomework = Object.values(homeworkMap).map((item) => ({ homeworkId: item.homeworkId, homeworkTitle: item.homeworkTitle, submissions: item.submissions, averagePercent: item.submissions ? Math.round(item.totalPercent / item.submissions) : 0, averageWrong: item.submissions ? Math.round((item.totalWrong / item.submissions) * 10) / 10 : 0 })).sort((a, b) => b.submissions - a.submissions || b.averagePercent - a.averagePercent).slice(0, 8);
  const averagePercent = totalSubmissions ? Math.round(submissions.reduce((sum, row) => sum + (Number(row.percent || 0) || 0), 0) / totalSubmissions) : 0;
  const onTimeCount = submissions.filter((row) => !row.timeUp).length;
  const summary = {
    totalAssignments: assignments.length,
    totalSubmissions,
    uniqueStudents: studentSet.size,
    averagePercent,
    onTimeRate: totalSubmissions ? Math.round((onTimeCount / totalSubmissions) * 100) : 0
  };
  return { ok:true, summary, classBreakdown, dailyTrend, topHomework };
}

async function listReports(filters){
  const store = await readStore();
  const rows = filterReports(Array.isArray(store.submissions) ? store.submissions : [], filters)
    .sort((a, b) => String(b.submittedAt || '').localeCompare(String(a.submittedAt || '')))
    .map(buildSubmissionSummary);
  return { ok:true, rows, total: rows.length };
}


async function parentSummary(payload){
  const store = await readStore();
  const student = await findStudentByCredentials(store, payload && payload.studentId, payload && payload.pin);
  if (!student) throw new Error('Student ID or PIN is not correct');
  const rows = (store.submissions || [])
    .filter((item) => String(item.studentId || '').trim() === String(student.studentId || '').trim())
    .sort((a, b) => String(b.submittedAt || '').localeCompare(String(a.submittedAt || '')));
  const summaries = rows.map(buildSubmissionSummary);
  const total = summaries.length;
  const averagePercent = total ? Math.round(summaries.reduce((sum, row) => sum + (Number(row.percent || 0) || 0), 0) / total) : 0;
  const bestPercent = total ? Math.max(...summaries.map((row) => Number(row.percent || 0) || 0)) : 0;
  const latest = summaries[0] || null;
  return {
    ok:true,
    student: publicStudent(student),
    summary: {
      totalSubmissions: total,
      averagePercent,
      bestPercent,
      latestHomework: latest ? latest.homeworkTitle : '',
      latestSubmittedAt: latest ? latest.submittedAt : ''
    },
    rows: summaries
  };
}

async function reportDetail(id){
  const reportId = String(id || '').trim();
  if (!reportId) throw new Error('Report id is required');
  const store = await readStore();
  const submission = (store.submissions || []).find((item) => String(item.id || '') === reportId);
  if (!submission) throw new Error('Homework report was not found');
  return { ok:true, row: submission };
}

module.exports = {
  list,
  save,
  remove,
  listForStudent,
  start,
  submit,
  listReports,
  reportDetail,
  analytics,
  identifyStudent,
  listStudents,
  saveStudent,
  deleteStudent,
  parentSummary
};
