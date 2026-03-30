
import { applyI18n, tr, escapeHtml } from './ui.js';
import { login, getAccounts, upsertAccount, deleteAccount, PERMISSIONS, builtInAdmins } from './accounts.js';
import { getClasses, saveClasses, collectQuestions, validateQuestion, findDuplicates, getQuestionOverrides, saveQuestionOverrides, allGrades } from './questions.js';
import { storage, keys } from './storage.js';

function settings(){
  return storage.get(keys.settings, {
    levelVisibility:{kg1:[10,20,30,40,50],kg2:[10,20,30,40,50]},
    timer:{kg1:true,kg2:true},
    passwords:{},
  });
}
function saveSettings(v){ storage.set(keys.settings, v); }
function activeTests(){ return storage.get(keys.activeTests, {}); }
function saveTests(v){ storage.set(keys.activeTests, v); }
function archivedTests(){ return storage.get(keys.archivedTests, []); }
function saveArchived(v){ storage.set(keys.archivedTests, v); }

let currentAccount = null;

function permissionLabel(p){
  return {
    dashboard:'Dashboard',
    users:'Users & Roles',
    classes:'Classes',
    questions:'Question Bank',
    bulk:'Bulk Import',
    tests:'Tests',
    settings:'Settings'
  }[p] || p;
}
function hasPerm(p){
  return currentAccount && currentAccount.role === 'admin' ? true : (currentAccount?.permissions || []).includes(p);
}
function renderSectionAccess(){
  document.querySelectorAll('[data-section]').forEach(sec => {
    const need = sec.dataset.section;
    sec.classList.toggle('hidden', !hasPerm(need));
  });
}
function renderAccounts(){
  const list = document.getElementById('accountsList');
  if(!list) return;
  const all = [...builtInAdmins(), ...getAccounts()];
  list.innerHTML = all.map(acc => `
    <div class="account-card">
      <div class="meta">
        <span class="pill"><strong>${escapeHtml(acc.display || acc.user)}</strong></span>
        <span class="pill">${acc.role}</span>
      </div>
      <p class="small">${escapeHtml((acc.permissions||[]).join(' • ') || 'all')}</p>
      <div class="actions">
        <button class="ghost-btn acc-edit" data-user="${escapeHtml(acc.user)}">Edit</button>
        <button class="ghost-btn acc-pass" data-user="${escapeHtml(acc.user)}">Change Password</button>
        ${acc.builtIn ? '' : `<button class="danger-btn acc-del" data-user="${escapeHtml(acc.user)}">Delete</button>`}
      </div>
    </div>
  `).join('');
  list.querySelectorAll('.acc-edit').forEach(b => b.onclick = () => {
    const u = b.dataset.user.toLowerCase();
    const acc = [...builtInAdmins(), ...getAccounts()].find(a => a.user.toLowerCase() === u);
    if(!acc) return;
    document.getElementById('accUser').value = acc.user;
    document.getElementById('accPass').value = acc.pass || '';
    document.getElementById('accRole').value = acc.role || 'user';
    renderPermissionChecks(acc.permissions || []);
  });
  list.querySelectorAll('.acc-pass').forEach(b => b.onclick = () => {
    const next = prompt('Enter new password');
    if(!next) return;
    const u = b.dataset.user;
    const built = builtInAdmins().find(a => a.user.toLowerCase() === u.toLowerCase());
    if(built){
      upsertAccount({ user:built.user, pass:next, role:'admin', permissions:[...PERMISSIONS] });
    }else{
      const acc = getAccounts().find(a => a.user.toLowerCase() === u.toLowerCase());
      if(acc){ acc.pass = next; upsertAccount(acc); }
    }
    renderAccounts();
  });
  list.querySelectorAll('.acc-del').forEach(b => b.onclick = () => {
    if(!confirm('Delete this account?')) return;
    deleteAccount(b.dataset.user);
    renderAccounts();
  });
}
function renderPermissionChecks(selected=[]){
  const wrap = document.getElementById('permWrap');
  if(!wrap) return;
  const role = document.getElementById('accRole')?.value || 'user';
  if(role === 'admin'){
    wrap.innerHTML = `<div class="notice">Admin gets all permissions.</div>`;
    return;
  }
  wrap.innerHTML = PERMISSIONS.map(p => `
    <label class="pill"><input type="checkbox" class="perm-check" value="${p}" ${selected.includes(p)?'checked':''}> ${permissionLabel(p)}</label>
  `).join(' ');
}
function renderClasses(){
  const list = document.getElementById('classList');
  if(!list) return;
  list.innerHTML = getClasses().map(c => `
    <div class="class-card">
      <div class="meta">
        <span class="pill"><strong>${escapeHtml(c.name)}</strong></span>
        ${c.hidden ? '<span class="pill">Hidden</span>' : ''}
      </div>
      <p class="small">${escapeHtml(c.description || '')}</p>
      <div class="actions">
        <button class="ghost-btn cls-edit" data-key="${escapeHtml(c.key)}">Edit</button>
        <button class="danger-btn cls-del" data-key="${escapeHtml(c.key)}">Delete</button>
      </div>
    </div>
  `).join('');
  list.querySelectorAll('.cls-edit').forEach(b => b.onclick = () => {
    const cls = getClasses().find(c => c.key === b.dataset.key);
    if(!cls) return;
    document.getElementById('className').value = cls.name;
    document.getElementById('classDesc').value = cls.description || '';
    document.getElementById('classHidden').checked = !!cls.hidden;
    document.getElementById('classEditKey').value = cls.key;
  });
  list.querySelectorAll('.cls-del').forEach(b => b.onclick = () => {
    if(!confirm('Delete class?')) return;
    saveClasses(getClasses().filter(c => c.key !== b.dataset.key));
    renderClasses();
  });
}
function gradeOptionsHtml(selected){
  return allGrades().map(g => {
    const name = g === 'kg1' ? 'KG1' : g === 'kg2' ? 'KG2' : (getClasses().find(c => c.key === g)?.name || g);
    return `<option value="${g}" ${selected===g?'selected':''}>${name}</option>`;
  }).join('');
}
function previewQuestion(){
  const grade = document.getElementById('qGrade').value;
  const type = document.getElementById('qType').value;
  const text = document.getElementById('qText').value.trim();
  const options = document.getElementById('qOptions').value.split('|').map(s=>s.trim()).filter(Boolean);
  const answer = document.getElementById('qAnswer').value.trim();
  const image = document.getElementById('qImage').value.trim();
  const q = { grade, type, text, options, answer, image, skill:document.getElementById('qSkill').value.trim() || 'Vocabulary' };
  const modal = document.getElementById('previewModal');
  const body = document.getElementById('previewBody');
  body.innerHTML = `<div class="question-card">
    <div class="meta"><span class="pill">${escapeHtml(grade.toUpperCase())}</span><span class="pill">${escapeHtml(type)}</span><span class="pill">${escapeHtml(q.skill)}</span></div>
    <h3>${escapeHtml(text)}</h3>
    ${image ? `<img src="${escapeHtml(image)}" style="max-width:180px">` : ''}
    <ul>${options.map(o => `<li>${escapeHtml(o)} ${o===answer?'✅':''}</li>`).join('')}</ul>
  </div>`;
  modal.classList.remove('hidden');
}
function renderQuestions(){
  const list = document.getElementById('questionsList');
  if(!list) return;
  const qSearch = (document.getElementById('qSearch')?.value || '').toLowerCase();
  const skillFilter = (document.getElementById('qSkillFilter')?.value || 'all').toLowerCase();
  const classFilter = (document.getElementById('qClassFilter')?.value || 'all').toLowerCase();
  let items = [];
  allGrades().forEach(g => { items = items.concat(collectQuestions(g).map(q => ({...q, _grade:g}))); });
  items = items.filter(q => (!qSearch || q.text.toLowerCase().includes(qSearch)) && (skillFilter === 'all' || (q.skill||'').toLowerCase() === skillFilter) && (classFilter === 'all' || q._grade === classFilter));
  list.innerHTML = items.map((q,idx) => `
    <div class="question-card">
      <div class="meta"><span class="pill">${escapeHtml(q._grade.toUpperCase())}</span><span class="pill">${escapeHtml(q.skill||'')}</span><span class="pill">${escapeHtml(q.type||'choice')}</span></div>
      <strong>${idx+1}. ${escapeHtml(q.text)}</strong>
      <div class="small">${escapeHtml((q.options||[]).join(' | '))}</div>
    </div>
  `).join('');
}
function refreshFilterSelects(){
  const classSel = document.getElementById('qClassFilter');
  const qGrade = document.getElementById('qGrade');
  const testGrade = document.getElementById('testGrade');
  if(classSel) classSel.innerHTML = `<option value="all">All Classes</option>` + gradeOptionsHtml();
  if(qGrade) qGrade.innerHTML = gradeOptionsHtml('kg1');
  if(testGrade) testGrade.innerHTML = gradeOptionsHtml('kg1');
}
function cloneTest(){
  const tests = activeTests();
  const from = document.getElementById('cloneFrom').value;
  const to = document.getElementById('cloneTo').value;
  if(!tests[from]) return alert('No source test found.');
  tests[to] = JSON.parse(JSON.stringify(tests[from]));
  saveTests(tests);
  alert('Quiz cloned.');
}
function archiveCurrentTest(){
  const grade = document.getElementById('testGrade').value;
  const tests = activeTests();
  if(!tests[grade]) return alert('No active test.');
  const arc = archivedTests();
  arc.push({ grade, ...tests[grade], archivedAt:new Date().toISOString() });
  tests[grade] = null;
  saveTests(tests);
  saveArchived(arc);
  alert('Test archived.');
}
function saveQuestion(){
  const grade = document.getElementById('qGrade').value;
  const type = document.getElementById('qType').value;
  const skill = document.getElementById('qSkill').value.trim() || 'Vocabulary';
  const text = document.getElementById('qText').value.trim();
  const options = document.getElementById('qOptions').value.split('|').map(s=>s.trim()).filter(Boolean);
  const answer = document.getElementById('qAnswer').value.trim();
  const image = document.getElementById('qImage').value.trim() || null;
  const q = { grade:grade.toUpperCase(), type, skill, text, options, answer, image };
  const valid = validateQuestion(q);
  if(!valid.valid) return alert(valid.errors.join('\n'));
  if(findDuplicates(grade, text).length) return alert(tr('duplicateFound'));
  const over = getQuestionOverrides();
  if(!Array.isArray(over[grade])) over[grade] = [];
  over[grade].push(q);
  saveQuestionOverrides(over);
  alert(tr('questionSaved'));
  renderQuestions();
}
function saveBulkCsvText(text){
  const lines = text.trim().split(/\r?\n/);
  const headers = lines.shift().split(',').map(s=>s.trim());
  const idx = Object.fromEntries(headers.map((h,i)=>[h,i]));
  const valid = [], errors = [];
  for(const line of lines){
    const cells = line.split(',').map(s=>s.trim());
    const q = {
      grade: String(cells[idx['grade']]||'').toLowerCase(),
      type: String(cells[idx['type']]||'choice'),
      skill: String(cells[idx['skill']]||'Vocabulary'),
      text: String(cells[idx['question']]||''),
      options: [cells[idx['choice1']],cells[idx['choice2']],cells[idx['choice3']],cells[idx['choice4']]].filter(Boolean),
      answer: String(cells[idx['answer']]||''),
      image: String(cells[idx['image']]||'') || null
    };
    const check = validateQuestion(q);
    if(findDuplicates(q.grade, q.text).length) check.errors.push('Duplicate question');
    if(check.valid && !check.errors.length) valid.push(q); else errors.push({ q:q.text, errors:check.errors });
  }
  document.getElementById('bulkReport').innerHTML = `<div class="notice">${valid.length} valid · ${errors.length} errors</div>` + errors.map(e => `<div class="small">${escapeHtml(e.q)}: ${escapeHtml(e.errors.join('; '))}</div>`).join('');
  if(valid.length){
    const over = getQuestionOverrides();
    valid.forEach(q => {
      if(!Array.isArray(over[q.grade])) over[q.grade] = [];
      over[q.grade].push({...q, grade:q.grade.toUpperCase()});
    });
    saveQuestionOverrides(over);
    renderQuestions();
  }
}
export function initAdmin(){
  applyI18n();
  refreshFilterSelects();
  const loginBtn = document.getElementById('adminLoginBtn');
  loginBtn.onclick = () => {
    const acc = login(document.getElementById('adminUser').value, document.getElementById('adminPass').value);
    if(!acc) return alert('Wrong admin name or password.');
    currentAccount = acc;
    document.getElementById('loginCard').classList.add('hidden');
    document.getElementById('adminPanel').classList.remove('hidden');
    renderSectionAccess();
    renderPermissionChecks([]);
    renderAccounts();
    renderClasses();
    renderQuestions();
  };
  document.getElementById('accRole')?.addEventListener('change', () => renderPermissionChecks([]));
  document.getElementById('saveAccountBtn')?.addEventListener('click', () => {
    const user = document.getElementById('accUser').value.trim().toLowerCase();
    const pass = document.getElementById('accPass').value.trim();
    const role = document.getElementById('accRole').value;
    if(!user || !pass) return alert('Please enter username and password.');
    const permissions = role === 'admin' ? [...PERMISSIONS] : [...document.querySelectorAll('.perm-check:checked')].map(el => el.value);
    if(role !== 'admin' && !permissions.length) return alert('Please choose at least one permission.');
    upsertAccount({ user, pass, role, permissions });
    document.getElementById('accUser').value = '';
    document.getElementById('accPass').value = '';
    renderPermissionChecks([]);
    renderAccounts();
    alert(tr('accountSaved'));
  });
  document.getElementById('saveClassBtn')?.addEventListener('click', () => {
    const name = document.getElementById('className').value.trim();
    if(!name) return alert('Enter class name.');
    const editKey = document.getElementById('classEditKey').value.trim();
    const key = editKey || name.toLowerCase().replace(/[^a-z0-9]+/g,'-');
    const classes = getClasses();
    const idx = classes.findIndex(c => c.key === key);
    const payload = { key, name, description:document.getElementById('classDesc').value.trim(), hidden:document.getElementById('classHidden').checked };
    if(idx >= 0) classes[idx] = payload; else classes.push(payload);
    saveClasses(classes);
    document.getElementById('className').value = '';
    document.getElementById('classDesc').value = '';
    document.getElementById('classHidden').checked = false
    document.getElementById('classEditKey').value = '';
    refreshFilterSelects();
    renderClasses();
    alert(tr('classSaved'));
  });
  // fix python artifact by replacing string below afterwards
  document.getElementById('previewQuestionBtn')?.addEventListener('click', previewQuestion);
  document.getElementById('saveQuestionBtn')?.addEventListener('click', saveQuestion);
  document.getElementById('qSearch')?.addEventListener('input', renderQuestions);
  document.getElementById('qSkillFilter')?.addEventListener('change', renderQuestions);
  document.getElementById('qClassFilter')?.addEventListener('change', renderQuestions);

  document.getElementById('saveTestBtn')?.addEventListener('click', () => {
    const tests = activeTests();
    const grade = document.getElementById('testGrade').value;
    tests[grade] = {
      name: document.getElementById('testName').value.trim() || `${grade.toUpperCase()} Test`,
      count: Number(document.getElementById('testCount').value || 10),
      questions: document.getElementById('testQuestions').value.split(/\n+/).map(s=>s.trim()).filter(Boolean)
    };
    saveTests(tests);
    alert('Test saved.');
  });
  document.getElementById('cloneQuizBtn')?.addEventListener('click', cloneTest);
  document.getElementById('archiveTestBtn')?.addEventListener('click', archiveCurrentTest);

  document.getElementById('downloadTemplateBtn')?.addEventListener('click', () => {
    const csv = 'grade,type,skill,question,choice1,choice2,choice3,choice4,answer,image\nkg1,choice,Vocabulary,What animal is this?,Dog,Cat,Bird,Fish,Cat,cat.svg\n';
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='bulk-questions-template.csv'; a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1200);
  });
  document.getElementById('bulkFile')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if(!file) return;
    const text = await file.text();
    saveBulkCsvText(text);
  });

  document.getElementById('closePreviewBtn')?.addEventListener('click', () => document.getElementById('previewModal').classList.add('hidden'));
}
