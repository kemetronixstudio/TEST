
import { storage, keys } from './storage.js';
import { collectQuestions, getClasses } from './questions.js';
import { getLang, tr, applyI18n } from './ui.js';

function getGradeMeta(grade){
  const g = String(grade||'').toLowerCase();
  if (g === 'kg1') return { title:'KG1', desc:'Beginner English', image:'school.svg' };
  if (g === 'kg2') return { title:'KG2', desc:'Growing English', image:'school.svg' };
  return getClasses().find(c => c.key === g) || { title:g.toUpperCase(), desc:'Custom class', image:'school.svg' };
}
function getSettings(){
  return storage.get(keys.settings, {
    levelVisibility:{kg1:[10,20,30,40,50],kg2:[10,20,30,40,50]},
    timer:{kg1:true,kg2:true},
    passwords:{},
  });
}
function activeTestFor(grade){
  const tests = storage.get(keys.activeTests, {});
  return tests[String(grade||'').toLowerCase()] || null;
}
function studentHistory(name){
  const attempts = storage.get(keys.attempts, []);
  return attempts.filter(a => a.studentName === name);
}
function rotateQuestions(grade, name, count){
  const pool = collectQuestions(grade);
  const usedTexts = new Set(studentHistory(name).flatMap(a => Array.isArray(a.questions) ? a.questions : []));
  const fresh = pool.filter(q => !usedTexts.has(q.text));
  const source = fresh.length >= count ? fresh : pool;
  const shuffled = [...source].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}
function speak(text){
  try{
    if(!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    setTimeout(() => window.speechSynthesis.speak(u), 120);
  }catch(e){}
}
function saveAttempt(record){
  const attempts = storage.get(keys.attempts, []);
  attempts.push(record);
  storage.set(keys.attempts, attempts);
}
function openCertificate(data){
  storage.set(keys.cert, data);
  location.href = 'certificate.html';
}
function buildQuestionHtml(q){
  if(q.type === 'input'){
    return `<input id="typedAnswer" class="option-btn" placeholder="Type here">`;
  }
  if(q.type === 'reorder'){
    return `<div class="options-grid">${(q.letters||[]).map(l => `<button class="option-btn reorder-letter">${l}</button>`).join('')}</div><div class="notice"><strong id="reorderTarget"></strong></div>`;
  }
  return `<div class="options-grid">${(q.options||[]).map(opt => `<button class="option-btn quiz-option">${opt}</button>`).join('')}</div>`;
}
export function initHome(){
  applyI18n();
  const grid = document.getElementById('levelGrid');
  if (!grid) return;
  const classes = [
    {key:'kg1', name:'KG1', desc:'Easy English for young learners'},
    {key:'kg2', name:'KG2', desc:'Stronger English for growing learners'},
    ...getClasses().filter(c => !c.hidden).map(c => ({key:c.key, name:c.name, desc:c.description || 'Custom class'}))
  ];
  grid.innerHTML = classes.map(c => `
    <a class="card level-card" href="kg.html?grade=${encodeURIComponent(c.key)}">
      <img src="school.svg" alt="${c.name}">
      <span class="badge">${c.name}</span>
      <h3>${c.name}</h3>
      <p>${c.desc}</p>
      <span class="main-btn">${tr('start')}</span>
    </a>
  `).join('');
  document.getElementById('homeTitle').textContent = tr('homeTitle');
  document.getElementById('homeLead').textContent = tr('homeLead');
}
export function initQuiz(){
  applyI18n();
  const qs = new URLSearchParams(location.search);
  const grade = (qs.get('grade') || 'kg1').toLowerCase();
  const meta = getGradeMeta(grade);
  const title = document.getElementById('quizTitle');
  const badge = document.getElementById('quizBadge');
  if (title) title.textContent = `${meta.title} Quiz`;
  if (badge) badge.textContent = meta.title;

  const studentInput = document.getElementById('studentName');
  const levelsWrap = document.getElementById('levelsWrap');
  const startWrap = document.getElementById('startWrap');
  const quizWrap = document.getElementById('quizWrap');
  const resultWrap = document.getElementById('resultWrap');

  const settings = getSettings();
  const visibleLevels = (settings.levelVisibility[grade] || [10,20,30,40,50]);
  levelsWrap.innerHTML = visibleLevels.map(n => `<button class="level-btn level-choice" data-count="${n}">Level ${visibleLevels.indexOf(n)+1} · ${n}</button>`).join('');

  let selectedCount = null, quizQuestions = [], current = 0, score = 0, timer = null, timeLeft = 15, answers = [], skillMiss = {};
  const timerEnabled = settings.timer[grade] !== false;

  levelsWrap.addEventListener('click', (e) => {
    const btn = e.target.closest('.level-choice');
    if(!btn) return;
    selectedCount = Number(btn.dataset.count);
    [...levelsWrap.querySelectorAll('.level-choice')].forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });

  document.getElementById('startQuizBtn')?.addEventListener('click', () => {
    const name = studentInput.value.trim();
    if(!name){ alert(tr('enterStudentName')); return; }
    if(!selectedCount){ alert(tr('chooseLevel')); return; }
    const activeTest = activeTestFor(grade);
    if(activeTest){
      const texts = activeTest.questions || [];
      const pool = collectQuestions(grade);
      quizQuestions = pool.filter(q => texts.includes(q.text)).slice(0, activeTest.count || texts.length);
    } else {
      quizQuestions = rotateQuestions(grade, name, selectedCount);
    }
    if(!quizQuestions.length){ alert(tr('noQuestions')); return; }
    current = 0; score = 0; answers = []; skillMiss = {};
    startWrap.classList.add('hidden');
    resultWrap.classList.add('hidden');
    quizWrap.classList.remove('hidden');
    renderQuestion();
  });

  function clearTimers(){
    if(timer){ clearInterval(timer); timer = null; }
    try{ speechSynthesis.cancel(); }catch(e){}
  }
  function renderQuestion(){
    clearTimers();
    const q = quizQuestions[current];
    document.getElementById('studentLabel').textContent = studentInput.value.trim();
    document.getElementById('scoreLabel').textContent = String(score);
    document.getElementById('questionLabel').textContent = `${current+1} / ${quizQuestions.length}`;
    document.getElementById('questionText').textContent = q.text;
    document.getElementById('questionType').textContent = q.type;
    const img = document.getElementById('questionImage');
    if(q.image){ img.src = q.image; img.classList.remove('hidden'); } else img.classList.add('hidden');
    const answersBox = document.getElementById('answersBox');
    answersBox.innerHTML = buildQuestionHtml(q);
    document.getElementById('progressFill').style.width = `${((current)/quizQuestions.length)*100}%`;

    if(q.type === 'reorder'){
      const target = document.getElementById('reorderTarget');
      let built = '';
      answersBox.querySelectorAll('.reorder-letter').forEach(btn => {
        btn.addEventListener('click', () => {
          built += btn.textContent;
          target.textContent = built;
          btn.disabled = true;
        });
      });
    } else {
      answersBox.querySelectorAll('.quiz-option').forEach(btn => {
        btn.addEventListener('click', () => submitAnswer(btn.textContent, btn));
      });
    }

    const readBtn = document.getElementById('readBtn');
    readBtn.onclick = () => speak(q.speech || q.text);

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.onclick = () => {
      if(q.type === 'input'){
        submitAnswer((document.getElementById('typedAnswer')?.value || '').trim());
      } else if(q.type === 'reorder'){
        submitAnswer((document.getElementById('reorderTarget')?.textContent || '').trim());
      }
    };

    timeLeft = 15;
    document.getElementById('timeLabel').textContent = timerEnabled ? String(timeLeft) : '∞';
    if(timerEnabled){
      timer = setInterval(() => {
        timeLeft -= 1;
        document.getElementById('timeLabel').textContent = String(timeLeft);
        if(timeLeft <= 0){
          clearTimers();
          submitAnswer('__timeout__');
        }
      }, 1000);
    }
  }

  function submitAnswer(value, btnEl){
    const q = quizQuestions[current];
    if(!q) return;
    clearTimers();
    let ok = false;
    if(q.type === 'input') ok = String(value).toLowerCase() === String(q.answer).toLowerCase();
    else ok = String(value).trim().toLowerCase() === String(q.answer).trim().toLowerCase();

    if(ok){
      score += timerEnabled ? (10 + Math.max(0,timeLeft)) : 10;
      if(btnEl) btnEl.classList.add('correct');
    }else{
      if(btnEl) btnEl.classList.add('wrong');
      skillMiss[q.skill] = (skillMiss[q.skill] || 0) + 1;
    }
    answers.push({ question:q.text, correct:ok, skill:q.skill });
    document.getElementById('scoreLabel').textContent = String(score);
    setTimeout(() => {
      current += 1;
      if(current < quizQuestions.length) renderQuestion();
      else finishQuiz();
    }, 600);
  }

  function finishQuiz(){
    quizWrap.classList.add('hidden');
    resultWrap.classList.remove('hidden');
    document.getElementById('finalScore').textContent = String(score);
    const percent = Math.round((score / (quizQuestions.length * (timerEnabled ? 25 : 10))) * 100);
    document.getElementById('finalPercent').textContent = `${percent}%`;
    const weaknesses = Object.entries(skillMiss).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([k])=>k);
    const strengths = [...new Set(quizQuestions.map(q=>q.skill))].filter(k => !weaknesses.includes(k)).slice(0,2);
    const advice = weaknesses.length ? `Focus more on ${weaknesses.join(' and ')}.` : 'Excellent work. Keep practicing.';
    document.getElementById('resultAdvice').textContent = advice;
    const cert = {
      studentName: studentInput.value.trim(),
      grade: meta.title,
      quizLevel: selectedCount,
      questionCount: quizQuestions.length,
      score,
      percent,
      date: new Date().toLocaleDateString(),
      strengths,
      weaknesses,
      advice,
      remark: percent >= 85 ? 'Excellent' : percent >= 65 ? 'Very Good' : 'Keep Practicing',
      questions: quizQuestions.map(q => q.text)
    };
    saveAttempt(cert);
    document.getElementById('certificateBtn').onclick = () => openCertificate(cert);
  }
}
