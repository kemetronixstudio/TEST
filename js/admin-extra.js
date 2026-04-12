
/* ---- BEGIN backend-access.js ---- */

if (typeof window.askTextInput !== 'function') window.askTextInput = function askTextInput(message, defaultValue){
  if (typeof window === 'undefined' || typeof document === 'undefined') return Promise.resolve(null);
  return new Promise(function(resolve){
    var overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(0,0,0,0.45)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '99999';

    var box = document.createElement('div');
    box.style.background = '#fff';
    box.style.borderRadius = '18px';
    box.style.padding = '18px';
    box.style.width = 'min(92vw, 420px)';
    box.style.boxShadow = '0 18px 42px rgba(0,0,0,.18)';

    var title = document.createElement('div');
    title.textContent = String(message || '');
    title.style.marginBottom = '12px';
    title.style.fontWeight = '700';

    var input = document.createElement('input');
    input.type = 'password';
    input.value = defaultValue || '';
    input.style.width = '100%';
    input.style.padding = '12px';
    input.style.borderRadius = '12px';
    input.style.border = '1px solid #ddd';
    input.style.marginBottom = '12px';

    var row = document.createElement('div');
    row.style.display = 'flex';
    row.style.justifyContent = 'flex-end';
    row.style.gap = '10px';

    var cancel = document.createElement('button');
    cancel.textContent = 'Cancel';
    cancel.type = 'button';
    cancel.style.padding = '10px 14px';
    cancel.style.borderRadius = '12px';
    cancel.style.border = '1px solid #ddd';
    cancel.style.background = '#fff';

    var ok = document.createElement('button');
    ok.textContent = 'OK';
    ok.type = 'button';
    ok.style.padding = '10px 14px';
    ok.style.borderRadius = '12px';
    ok.style.border = '0';
    ok.style.background = '#ffd54f';

    row.appendChild(cancel);
    row.appendChild(ok);
    box.appendChild(title);
    box.appendChild(input);
    box.appendChild(row);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    input.focus();

    function close(value){
      try { overlay.remove(); } catch (e) {}
      resolve(value);
    }
    cancel.addEventListener('click', function(){ close(null); });
    ok.addEventListener('click', function(){ close(input.value); });
    input.addEventListener('keydown', function(e){
      if (e.key === 'Enter') close(input.value);
      if (e.key === 'Escape') close(null);
    });
    overlay.addEventListener('click', function(e){
      if (e.target === overlay) close(null);
    });
  });
};

(function(){
  if (typeof document === 'undefined' || !document.body || document.body.dataset.page !== 'admin') return;

  const API_BASE = '/api/access-accounts';
  const TOKEN_KEY = 'kgAccessApiTokenV1';
  const LEGACY_TOKEN_KEY = 'admin_token';
  const ACCOUNT_KEY = 'kgEnglishAccessSessionV1';
  const ACCOUNT_STATUS_AUTO_CLEAR_MS = 2600;
  let accountCache = [];

  function lang(){
    try { return typeof getLang === 'function' ? getLang() : 'en'; } catch (error) { return 'en'; }
  }
  function t(key, fallback){
    try {
      return (((translations || {})[lang()] || {})[key]) || fallback;
    } catch (error) {
      return fallback;
    }
  }
  function allPerms(){
    return Array.isArray(window.PERMISSIONS) ? window.PERMISSIONS.slice() : ['dashboard','levelVisibility','timerSettings','quizAccess','teacherTest','bulkQuestions','questionBank','classManager','accountManager'];
  }
  function nonAdminPerms(){ return allPerms().filter(function(key){ return key !== 'accountManager'; }); }
  function isAdminOnlyPermission(key){ return key === 'accountManager'; }
  function escapeText(value){
    if (typeof escapeHtml === 'function') return escapeHtml(String(value || ''));
    return String(value || '').replace(/[&<>"']/g, function(ch){ return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[ch]; });
  }
  function permissionLabelSafe(key){
    try { return typeof permissionLabel === 'function' ? permissionLabel(key) : key; }
    catch (error) { return key; }
  }
  function normalizeUser(value){ return String(value || '').trim().toLowerCase(); }
  function currentAccount(){ return window.__currentAccessAccount || null; }
  function currentIsAdmin(){ return !!(currentAccount() && currentAccount().role === 'admin'); }
  function statusEl(){ return document.getElementById('accessAccountsStatus'); }
  function showStatus(message, state){
    const el = statusEl();
    if (!el) return;
    el.textContent = String(message || '').trim();
    if (showStatus._timer) clearTimeout(showStatus._timer);
    if (message) {
      el.dataset.state = state || 'info';
      showStatus._timer = setTimeout(function(){
        if (el.textContent === message) {
          el.textContent = '';
          delete el.dataset.state;
        }
      }, ACCOUNT_STATUS_AUTO_CLEAR_MS);
    } else {
      delete el.dataset.state;
    }
  }
  function persistSession(account, token){
    window.__currentAccessAccount = account || null;
    updateSessionMini();
    try {
      if (token) { sessionStorage.setItem(TOKEN_KEY, token); try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(LEGACY_TOKEN_KEY); } catch (e) {} }
      if (account) sessionStorage.setItem(ACCOUNT_KEY, JSON.stringify({ user: account.user, originalUser: account.originalUser || account.user, role: account.role }));
      else sessionStorage.removeItem(ACCOUNT_KEY);
      if (!account) {
        sessionStorage.removeItem(TOKEN_KEY);
        try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(LEGACY_TOKEN_KEY); } catch (e) {}
      }
    } catch (error) {}
  }
  function readToken(){
    try {
      return sessionStorage.getItem(TOKEN_KEY) || '';
    } catch (error) {
      return '';
    }
  }

  function forceLoginView(){
    const loginCard = document.getElementById('adminLoginCard');
    const panel = document.getElementById('adminPanel');
    if (panel) panel.classList.add('hidden');
    if (loginCard) loginCard.classList.remove('hidden');
  }
  function sessionMini(){ return document.getElementById('adminSessionMini'); }
  function securityStatus(){ return document.getElementById('adminSecurityStatus'); }
  function updateSessionMini(){
    const box = sessionMini();
    const account = currentAccount();
    if (!box) return;
    box.textContent = account ? ('Signed in: ' + account.user + ' (' + account.role + ')') : '';
  }
  function showSecurityStatus(message, state){
    const el = securityStatus();
    if (!el) return;
    el.textContent = message || '';
    el.dataset.state = state || 'info';
  }
  function clearStaleFrontendSession(){
    try {
      sessionStorage.removeItem(ACCOUNT_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(LEGACY_TOKEN_KEY);
    } catch (error) {}
    window.__currentAccessAccount = null;
    updateSessionMini();
  }
  function authHeaders(){
    const token = readToken();
    const headers = {};
    if (token) headers.Authorization = 'Bearer ' + token;
    return headers;
  }
  async function api(path, options){
    const method = String((options && options.method) || 'GET').toUpperCase();
    const finalOptions = Object.assign({
      credentials: 'same-origin',
      cache: 'no-store',
      headers: Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store, no-cache, max-age=0', Pragma: 'no-cache' }, authHeaders(), (options && options.headers) || {})
    }, options || {});
    if (method === 'GET' && !('body' in finalOptions)) delete finalOptions.body;
    const response = await fetch(API_BASE + path, finalOptions);
    let payload = {};
    try { payload = await response.json(); } catch (error) {}
    if (!response.ok || !payload.ok) {
      const err = new Error((payload && payload.error) || ('Request failed: ' + response.status));
      err.status = response.status;
      throw err;
    }
    return payload;
  }
  function cloneButton(id){
    const node = document.getElementById(id);
    if (!node || !node.parentNode) return node;
    const clone = node.cloneNode(true);
    node.parentNode.replaceChild(clone, node);
    return clone;
  }
  function setPanelVisible(account){
    const loginCard = document.getElementById('adminLoginCard');
    const panel = document.getElementById('adminPanel');
    if (loginCard) loginCard.classList.add('hidden');
    updateSessionMini();
    if (panel) panel.classList.remove('hidden');
    if (typeof window.applySectionPermissions === 'function') {
      try { window.applySectionPermissions(account); } catch (error) {}
    }
    if (typeof populateDashboardDateFilter === 'function') try { populateDashboardDateFilter(); } catch (error) {}
    if (typeof renderAdminDashboard === 'function') try { renderAdminDashboard(); } catch (error) {}
    if (typeof renderLevelVisibilityEditor === 'function') try { renderLevelVisibilityEditor(); } catch (error) {}
    if (typeof renderTimerSettingsEditor === 'function') try { renderTimerSettingsEditor(); } catch (error) {}
    if (typeof renderQuizAccessEditor === 'function') try { renderQuizAccessEditor(); } catch (error) {}
    if (typeof renderTeacherTestEditor === 'function') try { renderTeacherTestEditor(); } catch (error) {}
    if (typeof renderTeacherQuestionPicker === 'function') try { renderTeacherQuestionPicker(); } catch (error) {}
    if (typeof wireCollapseButtons === 'function') try { wireCollapseButtons(); } catch (error) {}
    if (typeof wireQuestionFilterButtons === 'function') try { wireQuestionFilterButtons(); } catch (error) {}
    if (typeof window.renderAccessLogs === 'function') try { window.renderAccessLogs(); } catch (error) {}
    if (typeof window.renderStudentCloudAdminPanel === 'function') try { window.renderStudentCloudAdminPanel(); } catch (error) {}
  }
  function clearForm(){
    const userEl = document.getElementById('accessAccountUser');
    const passEl = document.getElementById('accessAccountPass');
    const roleEl = document.getElementById('accessAccountRole');
    const saveBtn = document.getElementById('saveAccessAccountBtn');
    if (userEl) {
      userEl.value = '';
      userEl.dataset.originalUser = '';
      userEl.dataset.originalBuiltIn = '';
      userEl.dataset.keepPassword = '';
    }
    if (passEl) passEl.value = '';
    if (roleEl) roleEl.value = 'user';
    if (saveBtn) saveBtn.textContent = t('saveAccessAccount', 'Save Account');
    if (typeof window.renderAccessPermissions === 'function') window.renderAccessPermissions([]);
  }
  window.clearAccessAccountForm = clearForm;

  function collectSelectedPermissions(){
    return Array.from(document.querySelectorAll('.perm-check:checked')).map(function(el){ return el.value; }).filter(function(key){ return !isAdminOnlyPermission(key); });
  }

  async function refreshAccounts(){
    if (!currentIsAdmin()) {
      accountCache = [];
      const box = document.getElementById('accessAccountsList');
      if (box) box.innerHTML = '<div class="stored-question"><h4>' + escapeText('Account management is available to admins only.') + '</h4></div>';
      return [];
    }
    const fetchList = function(){
      return api('?ts=' + Date.now(), { method: 'GET' });
    };
    try {
      const payload = await fetchList();
      accountCache = Array.isArray(payload.accounts) ? payload.accounts : [];
      return accountCache;
    } catch (error) {
      if (error && error.status === 401) {
        clearStaleFrontendSession();
        forceLoginView();
      }
      throw error;
    }
  }



  async function refreshLogs(){
    const payload = await api('?action=logs&ts=' + Date.now(), { method: 'GET' });
    return Array.isArray(payload.logs) ? payload.logs : [];
  }

  window.renderAccessLogs = async function(){
    const box = document.getElementById('accessLogsList');
    if (!box) return;
    if (!currentIsAdmin()) {
      box.innerHTML = '<div class="stored-question"><h4>' + escapeText(lang()==='ar' ? 'سجل النشاط متاح للمشرف فقط.' : 'Activity logs are available to admins only.') + '</h4></div>';
      return;
    }
    box.innerHTML = '<div class="stored-question"><h4>' + escapeText(lang()==='ar' ? 'جار تحميل السجل...' : 'Loading activity logs...') + '</h4></div>';
    try {
      const logs = await refreshLogs();
      if (!logs.length) {
        box.innerHTML = '<div class="stored-question"><h4>' + escapeText(lang()==='ar' ? 'لا توجد سجلات بعد.' : 'No activity yet.') + '</h4></div>';
        return;
      }
      box.innerHTML = logs.map(function(item){
        const when = item.createdAt ? new Date(item.createdAt).toLocaleString() : '-';
        const title = (item.detail || item.action || 'Activity') + (item.target ? ' - ' + item.target : '');
        return '<div class="stored-question">'
          + '<h4>' + escapeText(title) + '</h4>'
          + '<div class="account-perms-line">' + escapeText('By: ' + (item.actor || '-') + ' | Time: ' + when) + '</div>'
          + '</div>';
      }).join('');
    } catch (error) {
      box.innerHTML = '<div class="stored-question"><h4>' + escapeText(error.message || 'Failed to load logs.') + '</h4></div>';
    }
  };

  window.renderAccessAccountsList = async function(){
    const box = document.getElementById('accessAccountsList');
    if (!box) return;
    if (!currentIsAdmin()) {
      box.innerHTML = '<div class="stored-question"><h4>' + escapeText(lang()==='ar' ? 'إدارة الحسابات متاحة للمشرف فقط.' : 'Account management is available to admins only.') + '</h4></div>';
      return;
    }
    showStatus('', 'info');
    box.innerHTML = '<div class="stored-question"><h4>' + escapeText(lang()==='ar' ? 'جار تحميل الحسابات...' : 'Loading accounts...') + '</h4></div>';
    try {
      const accounts = await refreshAccounts();
      if (!accounts.length) {
        box.innerHTML = '<div class="stored-question"><h4>' + escapeText(t('noExtraAccounts', 'No accounts yet.')) + '</h4></div>';
        return;
      }
      box.innerHTML = accounts.map(function(account){
        const safeUser = String(account.user || '').replace(/'/g, "\\'");
        const roleText = account.role === 'admin' ? (t('adminRole', 'Admin')) : (t('staffRole', 'Staff'));
        const stateText = account.builtIn
          ? (account.builtInOverride ? (lang()==='ar' ? 'مشرف أساسي + تعديل' : 'Built-in + Override') : (lang()==='ar' ? 'مشرف أساسي' : 'Built-in'))
          : (lang()==='ar' ? 'حساب مخصص' : 'Custom account');
        const perms = account.role === 'admin'
          ? (lang()==='ar' ? 'كل الصلاحيات' : 'Full access')
          : ((account.permissions || []).map(permissionLabelSafe).join(', ') || '-');
        return '<div class="account-card account-realfix-card account-pro-card">'
          + '<div class="account-meta-top"><strong class="account-name">' + escapeText(account.user || '') + '</strong><div class="account-badges"><span class="role-badge">' + escapeText(roleText) + '</span> <span class="state-badge">' + escapeText(stateText) + '</span></div></div>'
          + '<div class="account-perms-line">' + escapeText(perms) + '</div>'
          + '<div class="account-actions">'
          + '<button class="ghost-btn js-acc-edit" type="button" data-user="' + safeUser + '">' + escapeText(lang()==='ar' ? 'تعديل' : 'Edit') + '</button>'
          + '<button class="ghost-btn js-acc-pass" type="button" data-user="' + safeUser + '">' + escapeText(lang()==='ar' ? 'كلمة المرور' : 'Password') + '</button>'
          + '<button class="danger-btn js-acc-delete" type="button" data-user="' + safeUser + '">' + escapeText(t('deleteAccount', 'Delete')) + '</button>'
          + '</div></div>';
      }).join('');
    } catch (error) {
      box.innerHTML = '<div class="stored-question"><h4>' + escapeText(error.message || 'Failed to load accounts.') + '</h4></div>';
      showStatus(error.message || 'Failed to load accounts.', 'error');
    }
  };

  window.accEditByUser = function(user){
    if (!currentIsAdmin()) {
      showStatus(lang()==='ar' ? 'إدارة الحسابات متاحة للمشرف فقط.' : 'Only admins can manage accounts.', 'error');
      return;
    }
    const account = accountCache.find(function(item){ return normalizeUser(item.user) === normalizeUser(user); });
    if (!account) {
      showStatus(lang()==='ar' ? 'الحساب غير موجود.' : 'Account not found.', 'error');
      return;
    }
    const userEl = document.getElementById('accessAccountUser');
    const passEl = document.getElementById('accessAccountPass');
    const roleEl = document.getElementById('accessAccountRole');
    const saveBtn = document.getElementById('saveAccessAccountBtn');
    if (userEl) {
      userEl.value = account.user || '';
      userEl.dataset.originalUser = account.originalUser || account.user || '';
      userEl.dataset.originalBuiltIn = account.builtIn ? '1' : '';
      userEl.dataset.keepPassword = '1';
    }
    if (passEl) passEl.value = '';
    if (roleEl) roleEl.value = account.role || 'user';
    if (saveBtn) saveBtn.textContent = lang()==='ar' ? 'تحديث الحساب' : 'Update Account';
    if (typeof window.renderAccessPermissions === 'function') window.renderAccessPermissions(account.role === 'admin' ? [] : (account.permissions || []));
    showStatus(lang()==='ar' ? 'يمكنك الآن تعديل الحساب ثم الضغط على حفظ.' : 'You can now modify the account and save.', 'info');
  };

  window.accDeleteByUser = async function(user){
    if (!currentIsAdmin()) {
      showStatus(lang()==='ar' ? 'إدارة الحسابات متاحة للمشرف فقط.' : 'Only admins can manage accounts.', 'error');
      return;
    }
    const account = accountCache.find(function(item){ return normalizeUser(item.user) === normalizeUser(user); });
    if (!account) return;
    const message = account.builtIn
      ? (lang()==='ar' ? 'سيتم حذف التعديل فقط والرجوع إلى بيانات المشرف الأساسية. هل تريد المتابعة؟' : 'This removes only the override and restores the built-in admin. Continue?')
      : (lang()==='ar' ? 'هل تريد حذف هذا الحساب؟' : 'Delete this account?');
    if (!confirm(message)) return;
    try {
      await api('', { method: 'DELETE', body: JSON.stringify({ user: account.user }) });
      clearForm();
      await window.renderAccessAccountsList();
      if (typeof window.renderAccessLogs === 'function') await window.renderAccessLogs();
      showStatus(lang()==='ar' ? 'تم حذف الحساب بنجاح.' : 'Account deleted successfully.', 'success');
    } catch (error) {
      showStatus(error.message || 'Delete failed.', 'error');
    }
  };

  window.accChangePassByUser = async function(user){
    if (!currentIsAdmin()) {
      showStatus(lang()==='ar' ? 'إدارة الحسابات متاحة للمشرف فقط.' : 'Only admins can manage accounts.', 'error');
      return;
    }
    const account = accountCache.find(function(item){ return normalizeUser(item.user) === normalizeUser(user); });
    if (!account) return;
    const nextPass = window.askTextInput(lang()==='ar' ? 'أدخل كلمة المرور الجديدة' : 'New password:', '');
    if (!nextPass) return;
    try {
      const payload = await api('?action=change-password', { method: 'POST', body: JSON.stringify({ user: account.user, pass: nextPass }) });
      if (payload.token && payload.currentAccount) persistSession(payload.currentAccount, payload.token);
      await window.renderAccessAccountsList();
      if (typeof window.renderAccessLogs === 'function') await window.renderAccessLogs();
      showStatus(lang()==='ar' ? 'تم تحديث كلمة المرور بنجاح.' : 'Password updated successfully.', 'success');
    } catch (error) {
      showStatus(error.message || 'Password update failed.', 'error');
    }
  };

  window.saveAccessAccountFromAdmin = async function(){
    if (!currentIsAdmin()) {
      showStatus(lang()==='ar' ? 'إدارة الحسابات متاحة للمشرف فقط.' : 'Only admins can manage accounts.', 'error');
      return false;
    }
    const userEl = document.getElementById('accessAccountUser');
    const passEl = document.getElementById('accessAccountPass');
    const roleEl = document.getElementById('accessAccountRole');
    const user = String(userEl && userEl.value || '').trim();
    const pass = String(passEl && passEl.value || '').trim();
    const role = String(roleEl && roleEl.value || 'user').trim().toLowerCase() === 'admin' ? 'admin' : 'user';
    const originalUser = String(userEl && userEl.dataset.originalUser || '').trim();
    const originalBuiltIn = String(userEl && userEl.dataset.originalBuiltIn || '') === '1';
    const keepPassword = String(userEl && userEl.dataset.keepPassword || '') === '1' && !pass;
    if (!user) {
      showStatus(t('usernamePasswordRequired', 'Please enter username and password.'), 'error');
      return false;
    }
    let permissions = role === 'admin' ? allPerms() : collectSelectedPermissions();
    if (role !== 'admin' && permissions.length === 0) {
      showStatus(t('chooseOnePermission', 'Please choose at least one permission for this staff account.'), 'error');
      return false;
    }
    if (!pass && !keepPassword) {
      showStatus(t('usernamePasswordRequired', 'Please enter username and password.'), 'error');
      return false;
    }
    try {
      const payload = await api('', {
        method: 'POST',
        body: JSON.stringify({
          user: user,
          pass: pass,
          role: role,
          permissions: permissions,
          originalUser: originalUser || user,
          originalBuiltIn: originalBuiltIn,
          keepExistingPassword: keepPassword
        })
      });
      if (payload.token && payload.currentAccount) persistSession(payload.currentAccount, payload.token);
      clearForm();
      await window.renderAccessAccountsList();
      if (typeof window.renderAccessLogs === 'function') await window.renderAccessLogs();
      showStatus(t('accountSaved', 'Account saved.'), 'success');
      return true;
    } catch (error) {
      showStatus(error.message || 'Save failed.', 'error');
      return false;
    }
  };


  async function logout(){
    try { await fetch(API_BASE + '?action=logout', { method:'POST', credentials:'same-origin', headers:{ 'Content-Type':'application/json' } }); } catch (error) {}
    clearStaleFrontendSession();
    forceLoginView();
    showSecurityStatus('Logged out.', 'info');
  }

  async function changeMyPassword(){
    const currentPass = document.getElementById('selfCurrentPassword') && document.getElementById('selfCurrentPassword').value || '';
    const newPass = document.getElementById('selfNewPassword') && document.getElementById('selfNewPassword').value || '';
    if (!currentPass || !newPass) {
      showSecurityStatus('Enter current password and new password.', 'error');
      return;
    }
    try {
      const payload = await api('?action=change-password', { method:'POST', body: JSON.stringify({ currentPass: currentPass, newPass: newPass }) });
      if (payload.token && payload.currentAccount) persistSession(payload.currentAccount, payload.token);
      document.getElementById('selfCurrentPassword') && (document.getElementById('selfCurrentPassword').value = '');
      document.getElementById('selfNewPassword') && (document.getElementById('selfNewPassword').value = '');
      showSecurityStatus('Password changed successfully.', 'success');
    } catch (error) {
      showSecurityStatus(error.message || 'Could not change password.', 'error');
    }
  }

  async function handleLogin(event){
    if (event) event.preventDefault();
    const user = document.getElementById('adminUser') && document.getElementById('adminUser').value || '';
    const pass = document.getElementById('adminPass') && document.getElementById('adminPass').value || '';
    try {
      const payload = await api('?action=login', { method: 'POST', body: JSON.stringify({ user: user, pass: pass }), headers: { Authorization: '' } });
      persistSession(payload.account, payload.token);
      setPanelVisible(payload.account);
      if (typeof window.renderAccessPermissions === 'function') window.renderAccessPermissions([]);
      await window.renderAccessAccountsList();
      if (typeof window.renderAccessLogs === 'function') await window.renderAccessLogs();
    } catch (error) {
      alert((lang()==='ar' ? 'اسم المشرف أو كلمة المرور غير صحيحة.' : 'Wrong admin name or password.') + (error && error.status >= 500 ? ' ' + (lang()==='ar' ? 'تحقق من إعدادات الـ API.' : 'Check the backend API configuration.') : ''));
    }
  }

  async function restoreBackendSession(){
    const token = readToken();
    if (!token) {
      clearStaleFrontendSession();
      forceLoginView();
      return false;
    }
    try {
      const payload = await api('?action=me', { method: 'GET' });
      persistSession(payload.account, payload.token || token);
      setPanelVisible(payload.account);
      if (typeof window.renderAccessPermissions === 'function') window.renderAccessPermissions([]);
      await window.renderAccessAccountsList();
      return true;
    } catch (error) {
      clearStaleFrontendSession();
      forceLoginView();
      return false;
    }
  }

  function installHardCaptureBindings(){
    if (document.documentElement.dataset.backendAccessCaptureBound === '1') return;
    document.documentElement.dataset.backendAccessCaptureBound = '1';
    document.addEventListener('click', function(event){
      const loginBtn = event.target && event.target.closest ? event.target.closest('#adminLoginBtn') : null;
      if (loginBtn) {
        event.preventDefault();
        event.stopImmediatePropagation();
        handleLogin(event);
        return;
      }
      const saveBtn = event.target && event.target.closest ? event.target.closest('#saveAccessAccountBtn') : null;
      if (saveBtn) {
        event.preventDefault();
        event.stopImmediatePropagation();
        window.saveAccessAccountFromAdmin();
        return;
      }
      const collapseBtn = event.target && event.target.closest ? event.target.closest('#toggleQuestionBankEditorBtn') : null;
      if (collapseBtn) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (typeof window.toggleCollapse === 'function') window.toggleCollapse('questionBankEditorBody', collapseBtn);
        return;
      }
      const clearBtn = event.target && event.target.closest ? event.target.closest('#clearAccessAccountBtn') : null;
      if (clearBtn) {
        event.preventDefault();
        event.stopImmediatePropagation();
        clearForm();
        showStatus(lang()==='ar' ? 'تم مسح النموذج.' : 'Form cleared.', 'info');
      }
    }, true);
  }

  function bind(){
    forceLoginView();
    const loginBtn = cloneButton('adminLoginBtn');
    if (loginBtn) loginBtn.addEventListener('click', handleLogin);

    const saveBtn = cloneButton('saveAccessAccountBtn');
    if (saveBtn) saveBtn.addEventListener('click', function(event){
      event.preventDefault();
      window.saveAccessAccountFromAdmin();
    });

    const clearBtn = cloneButton('clearAccessAccountBtn');
    if (clearBtn) clearBtn.addEventListener('click', function(event){
      event.preventDefault();
      clearForm();
      showStatus(lang()==='ar' ? 'تم مسح النموذج.' : 'Form cleared.', 'info');
    });

    const exportDataBtn = cloneButton('exportDataBtn');
    if (exportDataBtn) exportDataBtn.addEventListener('click', function(event){ event.preventDefault(); if (typeof window.__kgSafeExportData === 'function') window.__kgSafeExportData(); });

    const adminLogoutBtn = cloneButton('adminLogoutBtn');
    if (adminLogoutBtn) adminLogoutBtn.addEventListener('click', function(event){ event.preventDefault(); logout(); });

    const selfChangePasswordBtn = cloneButton('selfChangePasswordBtn');
    if (selfChangePasswordBtn) selfChangePasswordBtn.addEventListener('click', function(event){ event.preventDefault(); changeMyPassword(); });

    const refreshLogsBtn = cloneButton('refreshAccessLogsBtn');
    if (refreshLogsBtn) refreshLogsBtn.addEventListener('click', function(event){ event.preventDefault(); if (typeof window.renderAccessLogs === 'function') window.renderAccessLogs(); });

    const collapseBtn = cloneButton('toggleQuestionBankEditorBtn');
    if (collapseBtn) collapseBtn.addEventListener('click', function(event){ event.preventDefault(); event.stopImmediatePropagation(); if (typeof window.toggleCollapse === 'function') window.toggleCollapse('questionBankEditorBody', collapseBtn); });

    const roleEl = cloneButton('accessAccountRole');
    if (roleEl) roleEl.addEventListener('change', function(){
      if (typeof window.renderAccessPermissions === 'function') window.renderAccessPermissions(collectSelectedPermissions());
    });

    if (typeof window.renderAccessPermissions === 'function') window.renderAccessPermissions([]);
    installHardCaptureBindings();
    restoreBackendSession();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
  window.addEventListener('load', function(){ restoreBackendSession(); });
})();

/* ---- END backend-access.js ---- */


/* ---- BEGIN student-cloud-admin.js ---- */
(function(){
  if (typeof document === 'undefined' || !document.body || document.body.dataset.page !== 'admin') return;
  const API_BASE = '/api/student';
  const TOKEN_KEYS = ['kgAccessApiTokenV1', 'admin_token'];
  let lastRows = [];
  let selectedIdentity = null;

  function token(){
    for (const key of TOKEN_KEYS) {
      try {
        const value = sessionStorage.getItem(key) || localStorage.getItem(key);
        if (value) return value;
      } catch (error) {}
    }
    return '';
  }
  async function request(path, options){
    const headers = Object.assign({ 'Cache-Control':'no-store' }, options && options.headers ? options.headers : {});
    const tk = token();
    if (tk) headers.Authorization = 'Bearer ' + tk;
    const res = await fetch(API_BASE + path, Object.assign({ credentials:'same-origin', cache:'no-store', headers }, options || {}));
    const data = await res.json().catch(()=>({ ok:false, error:'Request failed' }));
    if (!res.ok || !data.ok) throw new Error(data.error || ('Request failed: ' + res.status));
    return data;
  }
  async function api(path){ return request(path); }
  async function post(path, payload){
    return request(path, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload || {}) });
  }
  function status(msg){ const el = document.getElementById('studentCloudStatus'); if (el) el.textContent = msg || ''; }
  function analyticsStatus(msg){ const el = document.getElementById('studentAnalyticsStatus'); if (el) el.textContent = msg || ''; }
  function escapeHtml(value){ return String(value || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }

  function syncDashboardCardsFromCloud(totals){
    const map = {
      metricStudents: String(totals.totalStudents || 0),
      metricAttempts: String(totals.totalCompletedAttempts || 0),
      metricAverage: `${Number(totals.averagePercent || 0)}%`,
      metricWeak: totals.mostCommonWeakness || '-'
    };
    Object.entries(map).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    });
  }
  function syncDashboardTableFromCloud(leaderboard){
    const body = document.getElementById('studentTableBody');
    if (!body) return;
    const rows = Array.isArray(leaderboard) ? leaderboard.slice(0, 50) : [];
    body.innerHTML = rows.map(row => `<tr><td>${escapeHtml(row.studentName)}</td><td>${escapeHtml(row.grade || '-')}</td><td>${escapeHtml(String(row.attempts || 0))}</td><td>${escapeHtml(String(row.bestPercent || 0))}%</td><td>${escapeHtml(String(row.averagePercent || 0))}%</td><td>${escapeHtml((row.teacherNote || '').slice(0, 40) || '-')}</td></tr>`).join('') || '<tr><td colspan="6">No cloud student records yet.</td></tr>';
  }
  function leaderboardFallbackRows(leaderboard, filters){
    const q = String(filters.q || '').trim().toLowerCase();
    const cls = String(filters.className || '').trim().toLowerCase();
    const wantStatus = String(filters.status || '').trim().toLowerCase();
    if (wantStatus && wantStatus !== 'completed') return [];
    return (Array.isArray(leaderboard) ? leaderboard : []).filter(row => {
      const hay = [row.studentName, row.studentId, row.className, row.grade].join(' ').toLowerCase();
      if (q && !hay.includes(q)) return false;
      if (cls && String(row.className || '').trim().toLowerCase() !== cls) return false;
      return true;
    }).map((row, index) => ({
      key: row.key || row.identityKey || `leaderboard-${index}`,
      identityKey: row.identityKey || '',
      status: 'completed',
      studentName: row.studentName || '',
      studentId: row.studentId || '-',
      className: row.className || '-',
      grade: row.grade || '-',
      quizLevel: row.quizLevel || row.quizKey || '-',
      percent: Number(row.bestPercent || row.averagePercent || 0) || 0,
      teacherNote: row.teacherNote || '',
      updatedAt: row.updatedAt || row.lastUpdatedAt || ''
    }));
  }
  function renderRows(rows){
    const body = document.getElementById('studentCloudTableBody');
    if (!body) return;
    body.innerHTML = rows.map(row => `\n<tr data-key="${escapeHtml(row.key)}" class="student-cloud-row">\n<td>${escapeHtml(row.studentName)}</td>\n<td>${escapeHtml(row.studentId || '-')}</td>\n<td>${escapeHtml(row.className || '-')}</td>\n<td>${escapeHtml(row.grade || '-')}</td>\n<td>${escapeHtml(row.quizLevel || row.quizKey || '-')}</td>\n<td>${row.status === 'completed' ? `${escapeHtml(String(row.percent || 0))}%` : 'In Progress'}</td>\n<td>${escapeHtml((row.teacherNote || '').slice(0, 36) || '-')}</td>\n<td>${escapeHtml(row.updatedAt ? new Date(row.updatedAt).toLocaleString() : '-')}</td>\n<td><button type="button" class="ghost-btn small-btn student-cloud-view-btn" data-key="${escapeHtml(row.key)}">View</button></td>\n</tr>`).join('') || '<tr><td colspan="9">No cloud student records found.</td></tr>';
  }
  function getFilters(){
    return {
      q: document.getElementById('studentCloudSearch')?.value || '',
      className: document.getElementById('studentCloudClassFilter')?.value || '',
      status: document.getElementById('studentCloudStatusFilter')?.value || ''
    };
  }
  async function render(){
    status('Loading cloud records...');
    const filters = getFilters();
    const q = encodeURIComponent(filters.q);
    const className = encodeURIComponent(filters.className);
    const statusValue = encodeURIComponent(filters.status);
    try {
      const [listData, analyticsData] = await Promise.all([
        api(`/list?q=${q}&className=${className}&status=${statusValue}`),
        api(`/analytics?q=${q}&className=${className}`)
      ]);
      let rows = Array.isArray(listData.rows) ? listData.rows : [];
      const analytics = analyticsData || {};
      if (!rows.length) rows = leaderboardFallbackRows(analytics.leaderboard || [], filters);
      lastRows = rows.slice();
      renderRows(rows);
      status(rows.length ? `${rows.length} cloud record(s) loaded.` : 'No matching records. Try clearing filters.');
      if (typeof window.__kgClearUnauthorized === 'function') window.__kgClearUnauthorized();
      await renderAnalytics(analytics);
    } catch (error) {
      renderRows([]);
      status(error.message || 'Could not load cloud records.');
    }
  }
  async function renderAnalytics(prefetched){
    const filters = getFilters();
    analyticsStatus('Loading analytics...');
    try {
      const data = prefetched || await api(`/analytics?q=${encodeURIComponent(filters.q)}&className=${encodeURIComponent(filters.className)}`);
      const totals = data.totals || {};
      const classRows = Array.isArray(data.classAnalytics) ? data.classAnalytics : [];
      const leaderboard = Array.isArray(data.leaderboard) ? data.leaderboard : [];
      const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
      setText('studentAnalyticsAttempts', String(totals.totalCompletedAttempts || 0));
      setText('studentAnalyticsStudents', String(totals.totalStudents || 0));
      setText('studentAnalyticsClasses', String(totals.totalClasses || 0));
      setText('studentAnalyticsAverage', `${Number(totals.averagePercent || 0)}%`);
      syncDashboardCardsFromCloud(totals);

      const classBody = document.getElementById('classAnalyticsTableBody');
      if (classBody) {
        classBody.innerHTML = classRows.map(row => `<tr><td>${escapeHtml(row.className)}</td><td>${escapeHtml(row.grade)}</td><td>${escapeHtml(String(row.studentCount))}</td><td>${escapeHtml(String(row.attempts))}</td><td>${escapeHtml(String(row.averagePercent))}%</td><td>${escapeHtml(String(row.topScore))}%</td></tr>`).join('') || '<tr><td colspan="6">No completed cloud records yet.</td></tr>';
      }
      const leaderboardBody = document.getElementById('studentLeaderboardTableBody');
      if (leaderboardBody) {
        leaderboardBody.innerHTML = leaderboard.slice(0, 20).map((row, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(row.studentName)}</td><td>${escapeHtml(row.studentId || '-')}</td><td>${escapeHtml(row.className || '-')}</td><td>${escapeHtml(String(row.bestPercent || 0))}%</td><td>${escapeHtml(String(row.averagePercent || 0))}%</td><td>${escapeHtml(String(row.attempts || 0))}</td></tr>`).join('') || '<tr><td colspan="7">No leaderboard data yet.</td></tr>';
      }
      syncDashboardTableFromCloud(leaderboard);
      analyticsStatus(`Analytics ready. Top weakness: ${totals.mostCommonWeakness || '-'}`);
    } catch (error) {
      analyticsStatus(error.message || 'Could not load analytics.');
    }
  }
  async function viewRecord(key){
    const panel = document.getElementById('studentCloudDetail');
    if (!panel) return;
    panel.innerHTML = '<div class="stored-question"><h4>Loading...</h4></div>';
    try {
      const data = await api(`/detail?key=${encodeURIComponent(key)}`);
      const result = data.result;
      const progress = data.progress;
      const record = result || progress || {};
      const identity = record.identity || {};
      selectedIdentity = identity && identity.name ? identity : null;
      const noteObj = data.note || null;
      const answers = Array.isArray(record.answers) ? record.answers : [];
      panel.innerHTML = `\n<div class="stored-question">\n  <h4>${escapeHtml(record.studentName || identity.name || 'Student')}</h4>\n  <p><strong>Student ID:</strong> ${escapeHtml(record.studentId || identity.studentId || '-')}</p>\n  <p><strong>Class:</strong> ${escapeHtml(record.className || identity.className || '-')}</p>\n  <p><strong>Status:</strong> ${result ? 'Completed' : 'In Progress'}</p>\n  <p><strong>Quiz:</strong> ${escapeHtml(record.quizLevel || record.selectedLevelLabel || record.quizKey || '-')}</p>\n  <p><strong>Score:</strong> ${result ? escapeHtml(String(record.percent || 0) + '%') : escapeHtml(String((record.currentIndex || 0) + 1) + ' / ' + String((record.questions || []).length || record.selectedCount || 0))}</p>\n  <div class="teacher-note-box">\n    <label for="teacherStudentNote"><strong>Teacher Notes</strong></label>\n    <textarea id="teacherStudentNote" rows="4" placeholder="Add private teacher notes for this student...">${escapeHtml(noteObj && noteObj.note || '')}</textarea>\n    <div class="teacher-note-actions">\n      <button type="button" class="main-btn" id="saveTeacherStudentNoteBtn">Save Note</button>\n      <span class="muted-note" id="teacherStudentNoteStatus">${noteObj ? `Last updated ${escapeHtml(new Date(noteObj.updatedAt).toLocaleString())}${noteObj.author ? ' by ' + escapeHtml(noteObj.author) : ''}` : 'No note saved yet.'}</span>\n    </div>\n  </div>\n  <div class="student-cloud-answer-list">${answers.length ? answers.map(item => `<div class="student-cloud-answer-item"><strong>Q${Number(item.index || 0) + 1}.</strong> ${escapeHtml(item.questionText || '')}<br><span>Chosen: ${escapeHtml(item.chosen || (item.timedOut ? 'Timed out' : '-'))}</span> · <span>Correct: ${escapeHtml(item.expected || '-')}</span></div>`).join('') : '<div class="student-cloud-answer-item">No saved answers yet.</div>'}</div>\n</div>`;
    } catch (error) {
      panel.innerHTML = '<div class="stored-question"><h4>Could not load record details.</h4></div>';
      selectedIdentity = null;
    }
  }
  async function saveTeacherNote(){
    if (!selectedIdentity) return;
    const statusEl = document.getElementById('teacherStudentNoteStatus');
    const noteValue = document.getElementById('teacherStudentNote')?.value || '';
    if (statusEl) statusEl.textContent = 'Saving note...';
    try {
      const data = await post('/save-note', { identity: selectedIdentity, note: noteValue });
      if (statusEl) statusEl.textContent = `Saved ${new Date(data.note.updatedAt).toLocaleString()}${data.note.author ? ' by ' + data.note.author : ''}`;
      lastRows = lastRows.map(row => row.identityKey === selectedIdentity.identityKey ? Object.assign({}, row, { teacherNote: noteValue }) : row);
      await render();
    } catch (error) {
      if (statusEl) statusEl.textContent = error.message || 'Could not save note.';
    }
  }
  async function exportExcel(){
    status('Preparing Excel export...');
    try {
      const filters = getFilters();
      const q = encodeURIComponent(filters.q);
      const className = encodeURIComponent(filters.className);
      const statusValue = encodeURIComponent(filters.status);
      const [listData, analyticsData] = await Promise.all([
        api(`/list?q=${q}&className=${className}&status=${statusValue}`),
        api(`/analytics?q=${q}&className=${className}`)
      ]);
      let rows = Array.isArray(listData.rows) ? listData.rows : [];
      const analytics = analyticsData || {};
      if (!rows.length) rows = leaderboardFallbackRows(analytics.leaderboard || [], filters);
      const wb = XLSX.utils.book_new();
      const recordsSheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Info: 'No student rows found' }]);
      XLSX.utils.book_append_sheet(wb, recordsSheet, 'Student Records');
      const classSheet = XLSX.utils.json_to_sheet((analytics.classAnalytics || []).length ? analytics.classAnalytics : [{ Info: 'No class analytics yet' }]);
      XLSX.utils.book_append_sheet(wb, classSheet, 'Class Analytics');
      const leaderSheet = XLSX.utils.json_to_sheet((analytics.leaderboard || []).length ? analytics.leaderboard : [{ Info: 'No leaderboard yet' }]);
      XLSX.utils.book_append_sheet(wb, leaderSheet, 'Leaderboard');
      const summarySheet = XLSX.utils.json_to_sheet([analytics.totals || {}]);
      XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');
      const stamp = new Date().toISOString().slice(0,19).replace(/[T:]/g,'-');
      XLSX.writeFile(wb, `student-cloud-records-${stamp}.xlsx`);
      status('Excel export downloaded.');
    } catch (error) {
      status(error.message || 'Could not export Excel.');
    }
  }

  async function resetPlayLeaderboard(){
    if (!confirm('Are you sure you want to reset Play leaderboard?')) return;
    try {
      await request('/play?action=reset', { method: 'POST' });
      const leaderboardBody = document.getElementById('studentLeaderboardTableBody');
      if (leaderboardBody) leaderboardBody.innerHTML = '<tr><td colspan="7">No leaderboard data yet.</td></tr>';
      const classBody = document.getElementById('classAnalyticsTableBody');
      if (classBody) classBody.innerHTML = '<tr><td colspan="6">No class analytics yet.</td></tr>';
      analyticsStatus('Play leaderboard reset successfully.');
      status('Play leaderboard reset successfully.');
      await renderAnalytics();
      await render();
    } catch (error) {
      alert(error.message || 'Reset failed');
    }
  }

  async function resetAllCloudData(){
    const ok = confirm('Are you sure you want to reset all cloud student records and analytics?');
    if (!ok) return false;
    try {
      await request('/analytics?action=reset-all', { method: 'POST' });
      analyticsStatus('All cloud student data has been reset.');
      status('All cloud student data has been reset.');
      const leaderboardBody = document.getElementById('studentLeaderboardTableBody');
      if (leaderboardBody) leaderboardBody.innerHTML = '<tr><td colspan="7">No leaderboard data yet.</td></tr>';
      const classBody = document.getElementById('classAnalyticsTableBody');
      if (classBody) classBody.innerHTML = '<tr><td colspan="6">No class analytics yet.</td></tr>';
      const progressBody = document.getElementById('studentTableBody');
      if (progressBody) progressBody.innerHTML = '<tr><td colspan="6">No cloud student records yet.</td></tr>';
      await renderAnalytics();
      await render();
      return true;
    } catch (error) {
      alert(error.message || 'Reset failed');
      return false;
    }
  }

  window.resetCloudDashboardData = resetAllCloudData;

  function wire(){
    document.getElementById('refreshStudentCloudBtn')?.addEventListener('click', render);
    document.getElementById('refreshStudentAnalyticsBtn')?.addEventListener('click', ()=>renderAnalytics());
    document.getElementById('exportStudentCloudExcelBtn')?.addEventListener('click', exportExcel);
    document.getElementById('resetPlayLeaderboardBtn')?.addEventListener('click', resetPlayLeaderboard);
    document.getElementById('studentCloudSearchBtn')?.addEventListener('click', render);
    document.getElementById('studentCloudSearch')?.addEventListener('keydown', (e)=>{ if (e.key === 'Enter') render(); });
    document.getElementById('studentCloudClassFilter')?.addEventListener('keydown', (e)=>{ if (e.key === 'Enter') render(); });
    document.getElementById('studentCloudStatusFilter')?.addEventListener('change', render);
    document.addEventListener('click', (e)=>{
      const btn = e.target.closest('.student-cloud-view-btn');
      if (btn) {
        viewRecord(btn.dataset.key || '');
        return;
      }
      if (e.target && e.target.id === 'saveTeacherStudentNoteBtn') {
        saveTeacherNote();
      }
    });
  }
  wire();
  window.renderStudentCloudAdminPanel = render;
})();

/* ---- END student-cloud-admin.js ---- */


/* ---- BEGIN homework-admin.js ---- */

function normalizeAdminImagePath(value){
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^(https?:)?\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('/')) return raw;
  const clean = raw.replace(/^\.\//, '').replace(/^\/+/, '');
  if (/^assets\//i.test(clean)) return clean;
  if (/^(quiz-bulk|svg|img|icons)\//i.test(clean)) return 'assets/' + clean;
  return 'assets/quiz-bulk/' + clean;
}
(function(){
  if (typeof document === 'undefined' || !document.body || document.body.dataset.page !== 'admin') return;
  const API = '/api/homework';
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v || '').replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  let cachedPickerRows = [];
  let cachedAssignments = [];
  const selectedQuestionIds = new Set();

  function authHeaders(){
    try {
      const token = sessionStorage.getItem('kgAccessApiTokenV1') || localStorage.getItem('kgAccessApiTokenV1') || localStorage.getItem('admin_token') || '';
      return token ? { Authorization:'Bearer ' + token } : {};
    } catch (error) { return {}; }
  }

  async function api(path = '', options){
    const res = await fetch(API + path, Object.assign({ headers:Object.assign({ 'Content-Type':'application/json' }, authHeaders(), options && options.headers ? options.headers : {}), credentials:'same-origin', cache:'no-store' }, options || {}));
    const data = await res.json().catch(()=>({ ok:false, error:'Request failed' }));
    if (!res.ok || !data.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  function allQuestionsForGrade(grade){
    try {
      if (typeof allQuestionsFor === 'function') return allQuestionsFor(String(grade || '').toLowerCase()) || [];
      return [];
    } catch {
      return [];
    }
  }

  function questionSearchValue(){
    return String($('homeworkQuestionSearch')?.value || '').trim().toLowerCase();
  }

  function filteredPickerRows(){
    const q = questionSearchValue();
    if (!q) return cachedPickerRows;
    return cachedPickerRows.filter((row) => {
      return [row.skill, row.text, row.answer, ...(row.options || [])].some((v) => String(v || '').toLowerCase().includes(q));
    });
  }

  function updatePickerStatus(rows){
    const status = $('homeworkQuestionPickerStatus');
    if (!status) return;
    if (!cachedPickerRows.length) {
      status.textContent = 'No questions found for this grade.';
      return;
    }
    const q = questionSearchValue();
    status.textContent = q ? `${rows.length} question(s) match "${q}".` : `${rows.length} question(s) available.`;
  }

  function syncSelectedQuestionState(){
    document.querySelectorAll('.homework-question-check').forEach((el) => {
      const key = String(el.value || '');
      el.checked = selectedQuestionIds.has(key);
    });
  }

  function renderPicker(){
    const list = $('homeworkQuestionPickerList');
    if (!list) return;
    const grade = $('homeworkGrade')?.value || 'KG1';
    cachedPickerRows = allQuestionsForGrade(grade).slice(0, 500).map((q, i) => Object.assign({ __index:i }, q || {}));
    const validIds = new Set(cachedPickerRows.map((row) => String(row.__index)));
    [...selectedQuestionIds].forEach((id) => { if (!validIds.has(id)) selectedQuestionIds.delete(id); });
    const rows = filteredPickerRows();
    list.innerHTML = rows.map((q) => `<label class="teacher-picker-item"><input type="checkbox" class="homework-question-check" value="${q.__index}"><span><strong>${esc(q.skill || 'Question')}</strong><br>${esc(q.text || '')}</span></label>`).join('') || '<div class="muted-note">No questions found for this grade.</div>';
    syncSelectedQuestionState();
    updatePickerStatus(rows);
  }

  function selectedQuestions(){
    const source = cachedPickerRows.length ? cachedPickerRows : allQuestionsForGrade($('homeworkGrade')?.value || 'KG1').map((q, i) => Object.assign({ __index:i }, q || {}));
    const mapByIndex = new Map(source.map((row) => [String(row.__index), row]));
    return [...selectedQuestionIds]
      .map((id) => mapByIndex.get(String(id)))
      .filter(Boolean)
      .map((q) => ({ text:q.text, options:[...(q.options || [])], answer:q.answer, skill:q.skill || '', type:q.type || 'Question', image:q.image || null }));
  }

  function parseManualQuestions(){
    return String($('homeworkQuestionList')?.value || '')
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split('|').map((p) => p.trim()).filter(Boolean);
        if (parts.length < 4) return null;
        if (parts.length === 4) return { text:parts[0], options:parts.slice(1, 3), answer:parts[3], skill:'Homework', type:'TrueFalse', image:null };
        if (parts.length < 6) return null;
        return { text:parts[0], options:parts.slice(1, 5), answer:parts[5], skill:'Homework', type:'Question', image:null };
      })
      .filter(Boolean);
  }

  function formData(){
    const classes = String($('homeworkClasses')?.value || '').split(',').map((v) => v.trim()).filter(Boolean);
    const useTimer = !!$('homeworkTimerToggle')?.checked;
    const usePassword = !!$('homeworkPasswordToggle')?.checked;
    const mode = $('homeworkMode')?.value || 'select';
    const manualQuestions = parseManualQuestions();
    const pickedQuestions = selectedQuestions();
    const questions = mode === 'manual' ? (manualQuestions.length ? manualQuestions : pickedQuestions) : pickedQuestions;
    return {
      id: String($('reuseHomeworkSelect')?.dataset.loadedHomeworkId || '') || ('HW-' + Date.now()),
      title: String($('homeworkTitle')?.value || '').trim(),
      grade: String($('homeworkGrade')?.value || 'KG1').trim(),
      classes,
      date: String($('homeworkDate')?.value || '').trim(),
      mode,
      questions,
      useTimer,
      timerMinutes: useTimer ? Math.max(1, Number($('homeworkTimerMinutes')?.value || 0) || 0) : 0,
      usePassword,
      password: usePassword ? String($('homeworkPassword')?.value || '').trim() : '',
      tryLimit: Math.max(0, Math.min(5, Number($('homeworkTryLimit')?.value || 0) || 0)),
      createdAt: new Date().toISOString()
    };
  }

  async function renderList(){
    const wrap = $('homeworkAdminList');
    if (!wrap) return;
    try {
      cachedAssignments = ((await api()).rows || []).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
      wrap.innerHTML = cachedAssignments.map((row) => `<div class="stored-question"><h4>${esc(row.title || 'Homework')}</h4><p><strong>Grade:</strong> ${esc(row.grade)}</p><p><strong>Classes:</strong> ${esc((row.classes || []).join(', ') || 'All')}</p><p><strong>Date:</strong> ${esc(row.date || '-')}</p><p><strong>Questions:</strong> ${esc(String((row.questions || []).length))}</p><p><strong>Timer:</strong> ${row.useTimer ? esc(String(row.timerMinutes) + ' min') : 'No'}</p><p><strong>Password:</strong> ${row.usePassword ? 'Yes' : 'No'}</p><p><strong>Tries:</strong> ${Number(row.tryLimit || 0) > 0 ? esc(String(row.tryLimit)) : 'No limit'}</p><div class="action-row wrap-row"><button class="ghost-btn small-btn homework-load-btn" data-id="${esc(row.id)}" type="button">Load</button><button class="ghost-btn small-btn homework-delete-btn" data-id="${esc(row.id)}" type="button">Delete</button></div></div>`).join('') || '<div class="muted-note">No homework saved yet.</div>';
      renderReuseOptions();
    } catch (error) {
      wrap.innerHTML = `<div class="muted-note">${esc(error.message || 'Could not load homework.')}</div>`;
    }
  }

  function renderReuseOptions(){
    const select = $('reuseHomeworkSelect');
    if (!select) return;
    const current = select.value;
    const options = ['<option value="">Reuse saved homework</option>'].concat(cachedAssignments.map((row) => `<option value="${esc(row.id)}">${esc((row.date || '-') + ' • ' + (row.grade || '-') + ' • ' + (row.title || 'Homework'))}</option>`));
    select.innerHTML = options.join('');
    select.value = current;
  }

  function loadHomeworkIntoForm(id){
    const row = cachedAssignments.find((item) => String(item.id) === String(id));
    if (!row) return;
    $('homeworkTitle') && ($('homeworkTitle').value = row.title || '');
    $('homeworkGrade') && ($('homeworkGrade').value = row.grade || 'KG1');
    $('homeworkClasses') && ($('homeworkClasses').value = Array.isArray(row.classes) ? row.classes.join(', ') : '');
    $('homeworkDate') && ($('homeworkDate').value = row.date || '');
    $('homeworkMode') && ($('homeworkMode').value = 'select');
    $('homeworkTimerToggle') && ($('homeworkTimerToggle').checked = !!row.useTimer);
    $('homeworkTimerMinutes') && ($('homeworkTimerMinutes').value = row.useTimer ? (row.timerMinutes || '') : '');
    $('homeworkPasswordToggle') && ($('homeworkPasswordToggle').checked = !!row.usePassword);
    $('homeworkPassword') && ($('homeworkPassword').value = row.usePassword ? (row.password || '') : '');
    $('homeworkTryLimit') && ($('homeworkTryLimit').value = String(row.tryLimit || 0));
    $('homeworkQuestionList') && ($('homeworkQuestionList').value = (row.questions || []).map((q) => [q.text].concat(q.options || []).concat([q.answer]).join(' | ')).join('\n'));
    $('reuseHomeworkSelect') && ($('reuseHomeworkSelect').value = row.id);
    $('reuseHomeworkSelect') && ($('reuseHomeworkSelect').dataset.loadedHomeworkId = row.id);
    renderPicker();
    selectedQuestionIds.clear();
    const normalized = new Set((row.questions || []).map((q) => String(q.text || '').trim().toLowerCase()));
    cachedPickerRows.forEach((item) => {
      if (normalized.has(String(item.text || '').trim().toLowerCase())) selectedQuestionIds.add(String(item.__index));
    });
    syncSelectedQuestionState();
    updateModeVisibility();
    const status = $('homeworkAdminStatus');
    if (status) status.textContent = 'Saved homework loaded into the form. You can change date, classes, or questions and save again.';
  }

  function reportFilters(){
    return {
      q: String($('homeworkReportSearch')?.value || '').trim(),
      className: String($('homeworkReportClassFilter')?.value || '').trim(),
      grade: String($('homeworkAnalyticsGradeFilter')?.value || '').trim(),
      fromDate: String($('homeworkAnalyticsFromDate')?.value || '').trim(),
      toDate: String($('homeworkAnalyticsToDate')?.value || '').trim(),
      homeworkId: ''
    };
  }

  async function renderReports(){
    const body = $('homeworkReportTableBody');
    const status = $('homeworkReportStatus');
    if (!body) return;
    try {
      const filters = reportFilters();
      const query = `?action=reports&q=${encodeURIComponent(filters.q)}&className=${encodeURIComponent(filters.className)}&grade=${encodeURIComponent(filters.grade)}&fromDate=${encodeURIComponent(filters.fromDate)}&toDate=${encodeURIComponent(filters.toDate)}`;
      const data = await api(query);
      const rows = Array.isArray(data.rows) ? data.rows : [];
      body.innerHTML = rows.map((row) => `<tr><td>${esc(row.studentName)}</td><td>${esc(row.studentId || '-')}</td><td>${esc(row.className || '-')}</td><td>${esc(row.grade || '-')}</td><td>${esc(row.homeworkTitle || '-')}</td><td>${esc(String(row.score || 0))} / ${esc(String(row.questionCount || 0))}</td><td>${esc(String(row.percent || 0))}%</td><td>${esc(String(row.wrongAnswersCount || 0))}</td><td>${esc(String(row.triesUsed || 0))}</td><td>${esc(row.submittedAt ? new Date(row.submittedAt).toLocaleString() : '-')}</td><td><button class="ghost-btn small-btn homework-report-open-btn" data-id="${esc(row.id)}" type="button">Open</button></td></tr>`).join('') || '<tr><td colspan="11">No homework reports yet.</td></tr>';
      if (status) status.textContent = rows.length ? `${rows.length} homework report(s) loaded.` : 'No homework reports found.';
    } catch (error) {
      body.innerHTML = '<tr><td colspan="11">Could not load homework reports.</td></tr>';
      if (status) status.textContent = error.message || 'Could not load homework reports.';
    }
  }

  async function openReport(id){
    const detail = $('homeworkReportDetail');
    if (!detail) return;
    detail.innerHTML = '<div class="stored-question"><h4>Loading...</h4></div>';
    try {
      const data = await api(`?action=report-detail&id=${encodeURIComponent(id)}`);
      const row = data.row || {};
      const answers = Array.isArray(row.answers) ? row.answers : [];
      const wrongAnswers = Array.isArray(row.wrongAnswers) ? row.wrongAnswers : [];
      detail.innerHTML = `<div class="stored-question"><h4>${esc(row.studentName || 'Student')}</h4><p><strong>Student ID:</strong> ${esc(row.studentId || '-')}</p><p><strong>Class:</strong> ${esc(row.className || '-')}</p><p><strong>Grade:</strong> ${esc(row.grade || '-')}</p><p><strong>Homework:</strong> ${esc(row.homeworkTitle || '-')}</p><p><strong>Submitted:</strong> ${esc(row.submittedAt ? new Date(row.submittedAt).toLocaleString() : '-')}</p><p><strong>Score:</strong> ${esc(String(row.score || 0))} / ${esc(String(row.questionCount || 0))} (${esc(String(row.percent || 0))}%)</p><p><strong>Wrong answers:</strong> ${esc(String(row.wrongAnswersCount || 0))}</p><div class="student-cloud-answer-list">${answers.length ? answers.map((item) => `<div class="student-cloud-answer-item"><strong>Q${Number(item.index || 0) + 1}.</strong> ${esc(item.questionText || '')}<br><span>Chosen: ${esc(item.chosen || (item.timedOut ? 'Timed out' : '-'))}</span> · <span>Correct answer: ${esc(item.expected || '-')}</span> · <span>${item.correct ? 'Right' : 'Wrong'}</span></div>`).join('') : '<div class="student-cloud-answer-item">No saved answers.</div>'}</div>${wrongAnswers.length ? `<div class="stored-question"><h4>Wrong Answers Only</h4>${wrongAnswers.map((item) => `<p><strong>Q${Number(item.index || 0) + 1}:</strong> ${esc(item.questionText || '')}<br><span>Student answer: ${esc(item.chosen || (item.timedOut ? 'Timed out' : '-'))}</span> · <span>Correct answer: ${esc(item.expected || '-')}</span></p>`).join('')}</div>` : ''}</div>`;
    } catch {
      detail.innerHTML = '<div class="stored-question"><h4>Could not load homework report details.</h4></div>';
    }
  }


  async function renderHomeworkAnalytics(){
    const status = $('homeworkAnalyticsStatus');
    const filters = reportFilters();
    try {
      const query = `?action=analytics&className=${encodeURIComponent(filters.className)}&grade=${encodeURIComponent(filters.grade)}&fromDate=${encodeURIComponent(filters.fromDate)}&toDate=${encodeURIComponent(filters.toDate)}`;
      const data = await api(query);
      const summary = data.summary || {};
      const setText = (id, value) => { const el = $(id); if (el) el.textContent = value; };
      setText('hwMetricAssignments', String(summary.totalAssignments || 0));
      setText('hwMetricSubmissions', String(summary.totalSubmissions || 0));
      setText('hwMetricStudents', String(summary.uniqueStudents || 0));
      setText('hwMetricOnTime', `${Number(summary.onTimeRate || 0)}%`);
      const trend = Array.isArray(data.dailyTrend) ? data.dailyTrend : [];
      const maxSubs = Math.max(1, ...trend.map((item) => Number(item.submissions || 0) || 0));
      const trendBox = $('homeworkTrendBars');
      if (trendBox) trendBox.innerHTML = trend.map((item) => `<div class="simple-bar-row"><span class="bar-label">${esc(item.date || '')}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(8, Math.round(((Number(item.submissions || 0) || 0) / maxSubs) * 100))}%"></div></div><span class="bar-value">${esc(String(item.submissions || 0))} / ${esc(String(item.averagePercent || 0))}%</span></div>`).join('') || '<div class="muted-note">No homework trend yet.</div>';
      const topBody = $('homeworkTopTableBody');
      if (topBody) topBody.innerHTML = (data.topHomework || []).map((row) => `<tr><td>${esc(row.homeworkTitle || '-')}</td><td>${esc(String(row.submissions || 0))}</td><td>${esc(String(row.averagePercent || 0))}%</td><td>${esc(String(row.averageWrong || 0))}</td></tr>`).join('') || '<tr><td colspan="4">No homework submissions yet.</td></tr>';
      const classBody = $('homeworkClassBreakdownBody');
      if (classBody) classBody.innerHTML = (data.classBreakdown || []).map((row) => `<tr><td>${esc(row.className || '-')}</td><td>${esc(row.grade || '-')}</td><td>${esc(String(row.students || 0))}</td><td>${esc(String(row.submissions || 0))}</td><td>${esc(String(row.averagePercent || 0))}%</td></tr>`).join('') || '<tr><td colspan="5">No class homework analytics yet.</td></tr>';
      if (status) status.textContent = 'Homework analytics ready.';
    } catch (error) {
      if (status) status.textContent = error.message || 'Could not load homework analytics.';
    }
  }

  async function exportHomeworkExcel(){
    const status = $('homeworkReportStatus') || $('homeworkAnalyticsStatus');
    try {
      const filters = reportFilters();
      const query = `?action=reports&q=${encodeURIComponent(filters.q)}&className=${encodeURIComponent(filters.className)}&grade=${encodeURIComponent(filters.grade)}&fromDate=${encodeURIComponent(filters.fromDate)}&toDate=${encodeURIComponent(filters.toDate)}`;
      const [reportsData, analyticsData] = await Promise.all([api(query), api(`?action=analytics&className=${encodeURIComponent(filters.className)}&grade=${encodeURIComponent(filters.grade)}&fromDate=${encodeURIComponent(filters.fromDate)}&toDate=${encodeURIComponent(filters.toDate)}`)]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet((reportsData.rows || []).length ? reportsData.rows : [{ Info:'No homework reports found' }]), 'Homework Reports');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet((analyticsData.classBreakdown || []).length ? analyticsData.classBreakdown : [{ Info:'No class analytics' }]), 'Class Breakdown');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet((analyticsData.topHomework || []).length ? analyticsData.topHomework : [{ Info:'No top homework data' }]), 'Top Homework');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet((analyticsData.dailyTrend || []).length ? analyticsData.dailyTrend : [{ Info:'No daily trend' }]), 'Daily Trend');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([analyticsData.summary || {}]), 'Summary');
      XLSX.writeFile(wb, `homework-reports-${new Date().toISOString().slice(0,19).replace(/[T:]/g,'-')}.xlsx`);
      if (status) status.textContent = 'Homework Excel exported.';
    } catch (error) {
      if (status) status.textContent = error.message || 'Could not export homework Excel.';
    }
  }


  async function renderStudents(){
    const body = $('studentsTableBody');
    const search = String($('studentSearchInput')?.value || '').trim();
    if (!body) return;
    try {
      const data = await api(`?action=list-students&q=${encodeURIComponent(search)}`);
      const rows = Array.isArray(data.rows) ? data.rows : [];
      body.innerHTML = rows.map((row) => `<tr><td>${esc(row.studentId)}</td><td>${esc(row.pinLabel || row.pin || 'Stored securely')}</td><td>${esc(row.name)}</td><td>${esc(row.grade)}</td><td>${esc(row.className)}</td><td><button class="ghost-btn small-btn delete-student-btn" data-id="${esc(row.id)}" type="button">Delete</button></td></tr>`).join('') || '<tr><td colspan="6">No students yet.</td></tr>';
      const st = $('studentsStatus'); if (st) st.textContent = `${rows.length} student(s).`;
    } catch (error) {
      if (body) body.innerHTML = '<tr><td colspan="6">Could not load students.</td></tr>';
      const st = $('studentsStatus'); if (st) st.textContent = error.message || 'Could not load students.';
    }
  }

  async function saveStudentFromAdmin(){
    const name = String($('studentNameInput')?.value || '').trim();
    const grade = String($('studentGradeInput')?.value || 'KG1').trim();
    const className = String($('studentClassInput')?.value || '').trim();
    const pin = String($('studentPinInput')?.value || '').trim();
    if (!name || !className) { const st = $('studentsStatus'); if (st) st.textContent = 'Enter student name and class.'; return; }
    try {
      const data = await api('?action=save-student', { method:'POST', body: JSON.stringify({ name, grade, className, pin }) });
      $('studentNameInput').value = '';
      $('studentClassInput').value = '';
      if ($('studentPinInput')) $('studentPinInput').value = '';
      await renderStudents();
      const st = $('studentsStatus'); if (st) st.textContent = data && data.plainPin ? ('Student saved. PIN: ' + data.plainPin) : 'Student saved.';
    } catch (error) {
      const st = $('studentsStatus'); if (st) st.textContent = error.message || 'Could not save student.';
    }
  }

  function saveHomework(){
    const data = formData();
    const status = $('homeworkAdminStatus');
    if (!data.title) return status && (status.textContent = 'Please enter homework title.');
    if (!data.date) return status && (status.textContent = 'Please choose the date.');
    if (!data.questions.length) return status && (status.textContent = 'Please add questions first.');
    api('', { method:'POST', body: JSON.stringify(data) }).then(() => {
      if (status) status.textContent = 'Homework saved.';
      $('reuseHomeworkSelect') && delete $('reuseHomeworkSelect').dataset.loadedHomeworkId;
      renderList();
    }).catch((error) => {
      if (status) status.textContent = error.message || 'Could not save homework.';
    });
  }

  function clearForm(){
    ['homeworkTitle','homeworkClasses','homeworkDate','homeworkQuestionList','homeworkTimerMinutes','homeworkPassword','homeworkQuestionSearch'].forEach((id) => { if ($(id)) $(id).value = ''; });
    ['homeworkTimerToggle','homeworkPasswordToggle'].forEach((id) => { if ($(id)) $(id).checked = false; });
    if ($('homeworkTryLimit')) $('homeworkTryLimit').value = '0';
    if ($('homeworkMode')) $('homeworkMode').value = 'select';
    if ($('reuseHomeworkSelect')) { $('reuseHomeworkSelect').value = ''; delete $('reuseHomeworkSelect').dataset.loadedHomeworkId; }
    selectedQuestionIds.clear();
    document.querySelectorAll('.homework-question-check').forEach((el) => { el.checked = false; });
    if ($('homeworkAdminStatus')) $('homeworkAdminStatus').textContent = '';
    renderPicker();
    updateModeVisibility();
  }

  function updateModeVisibility(){
    const manual = ($('homeworkMode')?.value || 'select') === 'manual';
    $('homeworkQuestionList')?.classList.toggle('hidden', !manual);
    $('homeworkQuestionPickerWrap')?.classList.toggle('hidden', manual);
  }

  function wire(){
    $('homeworkGrade')?.addEventListener('change', () => { selectedQuestionIds.clear(); renderPicker(); updateModeVisibility(); });
    $('homeworkMode')?.addEventListener('change', updateModeVisibility);
    $('homeworkQuestionSearch')?.addEventListener('input', renderPicker);
    $('searchHomeworkQuestionsBtn')?.addEventListener('click', renderPicker);
    $('selectAllHomeworkQuestionsBtn')?.addEventListener('click', () => { filteredPickerRows().forEach((row) => selectedQuestionIds.add(String(row.__index))); syncSelectedQuestionState(); });
    $('clearHomeworkQuestionsBtn')?.addEventListener('click', () => { filteredPickerRows().forEach((row) => selectedQuestionIds.delete(String(row.__index))); syncSelectedQuestionState(); });
    $('saveHomeworkBtn')?.addEventListener('click', saveHomework);
    $('clearHomeworkBtn')?.addEventListener('click', clearForm);
    $('refreshHomeworkReportsBtn')?.addEventListener('click', () => { renderReports(); renderHomeworkAnalytics(); });
    $('homeworkReportSearchBtn')?.addEventListener('click', () => { renderReports(); renderHomeworkAnalytics(); });
    $('homeworkReportSearch')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') renderReports(); });
    $('homeworkReportClassFilter')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { renderReports(); renderHomeworkAnalytics(); } });
    $('refreshHomeworkAnalyticsBtn')?.addEventListener('click', renderHomeworkAnalytics);
    $('exportHomeworkReportsExcelBtn')?.addEventListener('click', exportHomeworkExcel);
    ['homeworkAnalyticsGradeFilter','homeworkAnalyticsClassFilter','homeworkAnalyticsFromDate','homeworkAnalyticsToDate'].forEach((id) => $(id)?.addEventListener('change', () => { renderReports(); renderHomeworkAnalytics(); }));
    $('loadReuseHomeworkBtn')?.addEventListener('click', () => loadHomeworkIntoForm($('reuseHomeworkSelect')?.value || ''));
  $('saveStudentBtn')?.addEventListener('click', saveStudentFromAdmin);
  $('studentSearchBtn')?.addEventListener('click', renderStudents);
  $('studentSearchInput')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') renderStudents(); });
    document.addEventListener('click', async (e) => {
const delStudent = e.target.closest('.delete-student-btn');
if (delStudent) { try { await api('?action=delete-student', { method:'DELETE', body: JSON.stringify({ id: delStudent.dataset.id || '' }) }); await renderStudents(); } catch (error) { const st = $('studentsStatus'); if (st) st.textContent = error.message || 'Could not delete student.'; } return; }

      const questionCheck = e.target.closest('.homework-question-check');
      if (questionCheck) {
        const key = String(questionCheck.value || '');
        if (questionCheck.checked) selectedQuestionIds.add(key);
        else selectedQuestionIds.delete(key);
      }
      const deleteBtn = e.target.closest('.homework-delete-btn');
      if (deleteBtn) {
        api('', { method:'DELETE', body: JSON.stringify({ id: deleteBtn.dataset.id }) }).then(() => renderList()).catch((error) => { $('homeworkAdminStatus').textContent = error.message || 'Could not delete homework.'; });
        return;
      }
      const loadBtn = e.target.closest('.homework-load-btn');
      if (loadBtn) {
        loadHomeworkIntoForm(loadBtn.dataset.id || '');
        return;
      }
      const reportBtn = e.target.closest('.homework-report-open-btn');
      if (reportBtn) openReport(reportBtn.dataset.id || '');
    });
  }

  renderPicker();
  renderList();
  renderReports();
  renderHomeworkAnalytics();
  wire();
  updateModeVisibility();
})();

/* ---- END homework-admin.js ---- */


/* ---- BEGIN next-upgrade-pack.js ---- */
(function(){
  const PAGE = document.body?.dataset?.page || '';
  const ADV_KEY = 'kgQuizAdvancedConfigsV1';
  const CUSTOM_Q_KEYS = ['kgEnglishCustomQuestionsV23'];
  function readJson(key, fallback){ try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch(e){ return fallback; } }
  function writeJson(key, value){ try { localStorage.setItem(key, JSON.stringify(value)); } catch(e){} return value; }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  function text(en, ar){ return (document.body?.dataset?.lang || 'en') === 'ar' ? ar : en; }
  function slug(v){ return String(v||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''); }
  function builtinGrades(){ return ['kg1','kg2','grade1','grade2','grade3','grade4','grade5','grade6']; }
  function customClasses(){ return (typeof window.getCustomClasses === 'function' ? window.getCustomClasses() : []).filter(Boolean); }
  function allGradeKeys(){ return builtinGrades().concat(customClasses().map(c => String(c.key || '').trim().toLowerCase()).filter(Boolean)); }
  function gradeLabel(key){
    const k = String(key || '').trim().toLowerCase();
    const map = {kg1:'KG1',kg2:'KG2',grade1:'Grade 1',grade2:'Grade 2',grade3:'Grade 3',grade4:'Grade 4',grade5:'Grade 5',grade6:'Grade 6'};
    if (map[k]) return map[k];
    const cls = customClasses().find(c => String(c.key || '').trim().toLowerCase() === k);
    return cls?.name || k.replace(/-/g,' ').replace(/\b\w/g, m => m.toUpperCase());
  }
  function getAdvanced(){ return readJson(ADV_KEY, {}); }
  function setAdvanced(v){ return writeJson(ADV_KEY, v); }
  function ensureStyles(){
    if (document.getElementById('next-upgrade-style')) return;
    const style = document.createElement('style');
    style.id = 'next-upgrade-style';
    style.textContent = `
      .upgrade-status-note{margin-top:10px;padding:10px 12px;border-radius:14px;background:#f7fbff;border:1px solid rgba(53,91,140,.14);color:#355b8c;font-weight:700}
      .upgrade-status-note[data-state="error"]{background:#fff5f5;border-color:rgba(207,63,63,.18);color:#c23c3c}
      .upgrade-status-note[data-state="success"]{background:#effbf1;border-color:rgba(31,143,77,.18);color:#1f8f4d}
      .upgrade-bulk-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
      .upgrade-bulk-row .ghost-btn{border-radius:999px}
      .question-ops-bar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:12px 0 8px}
      .question-ops-bar .ghost-btn{border-radius:999px}
      .question-ops-chip{display:inline-flex;align-items:center;padding:8px 12px;border-radius:999px;background:#f5f7fb;color:#486484;font-weight:700}
      .teacher-summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-top:12px}
      .teacher-summary-card{padding:12px;border:1px solid rgba(0,0,0,.08);border-radius:14px;background:#fff}
      .teacher-summary-card strong{display:block;font-size:1.15rem}
    `;
    document.head.appendChild(style);
  }
  function setStatus(el, message, state){
    if (!el) return;
    el.textContent = message || '';
    if (state) el.dataset.state = state; else el.removeAttribute('data-state');
  }
  function getQuestionPool(grade){
    if (typeof window.sanitizedPool === 'function') return window.sanitizedPool(grade) || [];
    if (typeof window.collectQuestionsWithMeta === 'function') return window.collectQuestionsWithMeta(grade) || [];
    return [];
  }
  function currentTeacherGrade(){ return String(document.getElementById('testGrade')?.value || '').trim().toLowerCase(); }
  function getTeacherStatusNote(){
    let note = document.getElementById('teacherUpgradeStatus');
    if (!note && document.getElementById('teacherAdvancedBox')){
      note = document.createElement('div');
      note.id = 'teacherUpgradeStatus';
      note.className = 'upgrade-status-note';
      document.getElementById('teacherAdvancedBox').appendChild(note);
    }
    return note;
  }
  function getQuestionStatusNote(){
    let note = document.getElementById('questionUpgradeStatus');
    if (!note){
      const host = document.getElementById('questionBankEditorBody');
      if (!host) return null;
      note = document.createElement('div');
      note.id = 'questionUpgradeStatus';
      note.className = 'upgrade-status-note';
      const target = document.getElementById('storedQuestionsWrap') || host;
      host.insertBefore(note, target);
    }
    return note;
  }
  function validateTeacherForm(){
    const grade = currentTeacherGrade();
    const mode = String(document.getElementById('testMode')?.value || 'random');
    const count = Math.max(1, Number(document.getElementById('testCount')?.value || 0) || 0);
    const lines = (document.getElementById('testQuestionList')?.value || '').split(/\n+/).map(v => v.trim()).filter(Boolean);
    const pool = getQuestionPool(grade);
    const adv = getAdvanced()[grade] || {};
    const openMs = adv.openAt ? Date.parse(adv.openAt) : NaN;
    const closeMs = adv.closeAt ? Date.parse(adv.closeAt) : NaN;
    if (!grade) return {ok:false, message:text('Choose a grade before saving the teacher quiz.','اختر الصف قبل حفظ اختبار المعلم.')};
    if (!document.getElementById('testName')?.value?.trim()) return {ok:false, message:text('Enter a test name before saving.','أدخل اسم الاختبار قبل الحفظ.')};
    if (!Number.isNaN(openMs) && !Number.isNaN(closeMs) && closeMs <= openMs) return {ok:false, message:text('Close time must be after open time.','وقت الإغلاق يجب أن يكون بعد وقت الفتح.')};
    if (mode === 'random' && pool.length < count) return {ok:false, message:text('Not enough questions in this grade for the requested random count.','لا توجد أسئلة كافية في هذا الصف لعدد الأسئلة العشوائي المطلوب.')};
    if ((mode === 'manual' || mode === 'select') && !lines.length) return {ok:false, message:text('Choose at least one question for manual/select mode.','اختر سؤالًا واحدًا على الأقل في الوضع اليدوي أو الاختيار.')};
    if ((mode === 'manual' || mode === 'select') && count > lines.length) return {ok:false, message:text('Question count cannot be larger than the selected question list.','عدد الأسئلة لا يمكن أن يكون أكبر من قائمة الأسئلة المختارة.')};
    return {ok:true, message:text('Teacher quiz is ready to save.','اختبار المعلم جاهز للحفظ.')};
  }
  function renderTeacherSummary(){
    const box = document.getElementById('teacherAdvancedBox');
    if (!box) return;
    let summary = document.getElementById('teacherSummaryGrid');
    if (!summary){
      summary = document.createElement('div');
      summary.id = 'teacherSummaryGrid';
      summary.className = 'teacher-summary-grid';
      box.insertBefore(summary, document.getElementById('teacherUpgradeStatus') || null);
    }
    const grade = currentTeacherGrade();
    const mode = String(document.getElementById('testMode')?.value || 'random');
    const count = Math.max(0, Number(document.getElementById('testCount')?.value || 0) || 0);
    const lines = (document.getElementById('testQuestionList')?.value || '').split(/\n+/).map(v => v.trim()).filter(Boolean);
    const poolCount = getQuestionPool(grade).length;
    summary.innerHTML = `
      <div class="teacher-summary-card"><small>${esc(text('Grade','الصف'))}</small><strong>${esc(gradeLabel(grade || ''))}</strong></div>
      <div class="teacher-summary-card"><small>${esc(text('Available questions','الأسئلة المتاحة'))}</small><strong>${poolCount}</strong></div>
      <div class="teacher-summary-card"><small>${esc(text('Mode','الوضع'))}</small><strong>${esc(mode.toUpperCase())}</strong></div>
      <div class="teacher-summary-card"><small>${esc(text('Selected count','العدد المختار'))}</small><strong>${mode === 'random' ? count : lines.length}</strong></div>`;
  }
  function wireTeacherValidation(){
    if (PAGE !== 'admin') return;
    const saveBtn = document.getElementById('saveTeacherTestBtn');
    if (!saveBtn || saveBtn.dataset.nextUpgradeWrapped === '1') return;
    saveBtn.dataset.nextUpgradeWrapped = '1';
    const clone = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(clone, saveBtn);
    clone.addEventListener('click', function(e){
      e.preventDefault();
      const note = getTeacherStatusNote();
      const check = validateTeacherForm();
      renderTeacherSummary();
      if (!check.ok){ setStatus(note, check.message, 'error'); return; }
      if (typeof window.saveTeacherTestFromAdmin === 'function') window.saveTeacherTestFromAdmin();
      setTimeout(() => setStatus(note, text('Teacher quiz saved successfully.','تم حفظ اختبار المعلم بنجاح.'), 'success'), 40);
    });
    ['testGrade','testName','testMode','testCount','testQuestionList','advTeacherOpenAt','advTeacherCloseAt'].forEach(id => {
      const el = document.getElementById(id);
      if (el && el.dataset.nextUpgradeWatch !== '1'){
        el.dataset.nextUpgradeWatch = '1';
        const handler = () => { renderTeacherSummary(); const check = validateTeacherForm(); setStatus(getTeacherStatusNote(), check.message, check.ok ? '' : 'error'); };
        el.addEventListener('input', handler);
        el.addEventListener('change', handler);
      }
    });
    renderTeacherSummary();
    const first = validateTeacherForm();
    setStatus(getTeacherStatusNote(), first.message, first.ok ? '' : 'error');
  }
  function ensureBulkStatusButtons(){
    if (PAGE !== 'admin') return;
    const box = document.getElementById('teacherAdvancedBox');
    if (!box || document.getElementById('bulkStatusRow')) return;
    const row = document.createElement('div');
    row.id = 'bulkStatusRow';
    row.className = 'upgrade-bulk-row';
    row.innerHTML = `
      <button class="ghost-btn" type="button" data-bulk-status="visible">${esc(text('Set all quizzes VISIBLE','جعل كل الاختبارات ظاهرة'))}</button>
      <button class="ghost-btn" type="button" data-bulk-status="hidden">${esc(text('Set all quizzes HIDDEN','جعل كل الاختبارات مخفية'))}</button>
      <button class="ghost-btn" type="button" data-bulk-status="frozen">${esc(text('Set all quizzes FROZEN','جعل كل الاختبارات مجمدة'))}</button>`;
    box.appendChild(row);
    row.querySelectorAll('[data-bulk-status]').forEach(btn => btn.addEventListener('click', function(){
      const status = String(btn.dataset.bulkStatus || 'visible');
      const all = getAdvanced();
      allGradeKeys().forEach(key => { all[key] = Object.assign({}, all[key] || {}, { status }); });
      setAdvanced(all);
      setStatus(getTeacherStatusNote(), text('Bulk quiz status updated for all grades and classes.','تم تحديث حالة كل الاختبارات لكل الصفوف والفصول.'), 'success');
      if (typeof document.getElementById('saveTeacherAdvancedBtn')?.click === 'function') {
        try { renderTeacherSummary(); } catch(e){}
      }
    }));
  }
  function persistCustomQuestions(map){
    CUSTOM_Q_KEYS.forEach(key => writeJson(key, map));
  }
  function normalizeQuestionType(value){
    const raw = String(value || 'Choice').trim();
    return raw || 'Choice';
  }
  function wireQuestionValidation(){
    if (PAGE !== 'admin') return;
    const addBtn = document.getElementById('addQuestionBtn');
    if (!addBtn || addBtn.dataset.nextUpgradeWrapped === '1') return;
    addBtn.dataset.nextUpgradeWrapped = '1';
    const clone = addBtn.cloneNode(true);
    addBtn.parentNode.replaceChild(clone, addBtn);
    clone.addEventListener('click', function(e){
      e.preventDefault();
      const note = getQuestionStatusNote();
      const grade = String(document.getElementById('newQGrade')?.value || '').trim().toLowerCase();
      const skill = String(document.getElementById('newQSkill')?.value || '').trim() || 'Vocabulary';
      const type = normalizeQuestionType(document.getElementById('newQType')?.value);
      const textValue = String(document.getElementById('newQText')?.value || '').trim();
      const options = String(document.getElementById('newQOptions')?.value || '').split('|').map(v => v.trim()).filter(Boolean);
      const answer = String(document.getElementById('newQAnswer')?.value || '').trim();
      const difficulty = Math.max(1, Math.min(3, Number(document.getElementById('newQDifficulty')?.value || 1) || 1));
      const image = String(document.getElementById('newQImage')?.value || '').trim() || document.getElementById('newQImageFile')?.dataset?.savedImage || null;
      const allowed = new Set(allGradeKeys());
      if (!grade || !allowed.has(grade)) { setStatus(note, text('Choose a valid grade or class before adding the question.','اختر صفًا أو فصلًا صحيحًا قبل إضافة السؤال.'), 'error'); return; }
      if (!textValue || !answer) { setStatus(note, text('Question text and correct answer are required.','نص السؤال والإجابة الصحيحة مطلوبان.'), 'error'); return; }
      if (/choice/i.test(type) && !options.length) { setStatus(note, text('Choice questions need options separated by |.','أسئلة الاختيار تحتاج خيارات مفصولة بـ |.'), 'error'); return; }
      const finalOptions = options.slice();
      if (/choice/i.test(type) && answer && !finalOptions.some(v => v.toLowerCase() === answer.toLowerCase())) finalOptions.push(answer);
      const map = (typeof window.getCustomQuestions === 'function' ? window.getCustomQuestions() : {}) || {};
      if (!Array.isArray(map[grade])) map[grade] = [];
      const duplicate = map[grade].find(q => String(q?.text || '').trim().toLowerCase() === textValue.toLowerCase());
      if (duplicate) { setStatus(note, text('A question with the same text already exists in this grade/class.','يوجد سؤال بنفس النص بالفعل داخل هذا الصف أو الفصل.'), 'error'); return; }
      map[grade].push({ grade: gradeLabel(grade), skill, type, text: textValue, options: finalOptions, answer, image, difficulty });
      persistCustomQuestions(map);
      ['newQGrade','newQSkill','newQType','newQText','newQOptions','newQAnswer','newQDifficulty','newQImage'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
      const fileEl = document.getElementById('newQImageFile');
      if (fileEl){ fileEl.value = ''; fileEl.dataset.savedImage = ''; }
      if (typeof window.renderStoredQuestions === 'function') window.renderStoredQuestions();
      setStatus(note, text('Question added and validated successfully.','تمت إضافة السؤال والتحقق منه بنجاح.'), 'success');
    });
    const summaryBar = document.createElement('div');
    summaryBar.id = 'questionOpsBar';
    summaryBar.className = 'question-ops-bar';
    summaryBar.innerHTML = `<span class="question-ops-chip" id="questionOpsChip">${esc(text('Question bank filters ready.','فلاتر بنك الأسئلة جاهزة.'))}</span>`;
    const host = document.querySelector('#questionBankEditorBody .toolbar');
    if (host && !document.getElementById('questionOpsBar')) host.parentNode.insertBefore(summaryBar, host.nextSibling);
  }
  function updateQuestionSearchSummary(){
    if (PAGE !== 'admin') return;
    const list = document.getElementById('storedQuestionsList');
    const chip = document.getElementById('questionOpsChip');
    const status = document.getElementById('questionSearchStatus');
    if (!list || !chip || !status) return;
    const visible = Array.from(list.querySelectorAll('.question-edit-card')).filter(card => card.style.display !== 'none').length;
    const total = list.querySelectorAll('.question-edit-card').length;
    const filters = [];
    const grade = String(document.querySelector('[data-filter-grade].active')?.dataset?.filterGrade || 'all');
    const q = String(document.getElementById('qSearchInput')?.value || '').trim();
    const skill = String(document.getElementById('qSkillFilterInput')?.value || '').trim();
    const className = String(document.getElementById('qClassFilterInput')?.value || '').trim();
    if (grade && grade.toLowerCase() !== 'all') filters.push(grade);
    if (q) filters.push(text('text','النص') + ': ' + q);
    if (skill) filters.push(text('skill','المهارة') + ': ' + skill);
    if (className) filters.push(text('class','الفصل') + ': ' + className);
    chip.textContent = filters.length ? filters.join(' • ') : text('Showing all questions.','عرض كل الأسئلة.');
    status.textContent = visible + ' / ' + total + ' ' + text('questions shown.','سؤال ظاهر.');
  }
  function wireQuestionSummaryObservers(){
    if (PAGE !== 'admin') return;
    const observerTarget = document.getElementById('storedQuestionsList');
    if (observerTarget && !observerTarget.dataset.nextUpgradeObserved){
      observerTarget.dataset.nextUpgradeObserved = '1';
      const obs = new MutationObserver(() => setTimeout(updateQuestionSearchSummary, 20));
      obs.observe(observerTarget, { childList:true, subtree:true, attributes:true, attributeFilter:['style','class'] });
    }
    document.querySelectorAll('[data-filter-grade], #qSearchInput, #qSkillFilterInput, #qClassFilterInput, #runQuestionSearchBtn, #clearQuestionSearchBtn, #showStoredQuestionsBtn').forEach(el => {
      if (el && el.dataset.nextUpgradeWatch !== '1'){
        el.dataset.nextUpgradeWatch = '1';
        el.addEventListener('click', () => setTimeout(updateQuestionSearchSummary, 20));
        el.addEventListener('input', () => setTimeout(updateQuestionSearchSummary, 20));
        el.addEventListener('change', () => setTimeout(updateQuestionSearchSummary, 20));
      }
    });
    setTimeout(updateQuestionSearchSummary, 80);
  }
  function init(){
    ensureStyles();
    if (PAGE === 'admin'){
      wireTeacherValidation();
      ensureBulkStatusButtons();
      wireQuestionValidation();
      wireQuestionSummaryObservers();
    }
  }
  window.addEventListener('load', () => setTimeout(init, 320));
})();

/* ---- END next-upgrade-pack.js ---- */


/* ---- BEGIN final-polish-pack.js ---- */
(function(){
  const PAGE = document.body?.dataset?.page || '';
  if (PAGE !== 'admin') return;
  const BACKUP_KEYS = [
    'kgQuizAdvancedConfigsV1',
    'kgAppLang',
    'kgKidsThemeV1',
    'kgEnglishProgressV7',
    'kgEnglishStudentRecordsV7',
    'kgEnglishAnalyticsV7',
    'kgEnglishCertificateV7',
    'kgEnglishCustomQuestionsV23',
    'kgEnglishQuestionOverridesV7',
    'kgEnglishDeletedQuestionsV2',
    'kgEnglishLevelVisibilityV7',
    'kgEnglishAttemptsLogV22',
    'kgEnglishTimerSettingsV23',
    'kgEnglishQuizAccessV29',
    'kgEnglishTeacherTestsV23',
    'kgEnglishArchivedTeacherTestsV23',
    'kgEnglishStudentRotationV23',
    'kgEnglishCustomClassesV29',
    'kgHomeworkStaticStoreV1',
    'kgStudentIdentityV1',
    'kgStudentCloudLocalV1',
    'kgPlayLeaderboardLocalV1',
    'kgPlayTestSound',
    'kgPlayTestAutoNext'
  ];
  const BACKUP_IMPORT_ALIASES = {
    kgQuizLevelVisibilityV1: 'kgEnglishLevelVisibilityV7',
    kgQuizTimerSettingsV1: 'kgEnglishTimerSettingsV23',
    kgQuizAccessPasswordsV1: 'kgEnglishQuizAccessV29',
    kgTeacherTestV1: 'kgEnglishTeacherTestsV23',
    kgTeacherArchivedTestsV1: 'kgEnglishArchivedTeacherTestsV23',
    kgQuestionOverridesV1: 'kgEnglishQuestionOverridesV7',
    kgCustomClassesV1: 'kgEnglishCustomClassesV29',
    kgStudentProgressV1: 'kgEnglishProgressV7',
    kgStudentRecordsV1: 'kgEnglishStudentRecordsV7',
    kgAttemptsLogV1: 'kgEnglishAttemptsLogV22',
    kgAnalyticsV1: 'kgEnglishAnalyticsV7',
    kgPlayLeaderboardV1: 'kgPlayLeaderboardLocalV1'
  };
  const DRAFT_KEY = 'kgAdminDraftsV2';
  function jread(key, fallback){ try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch(e){ return fallback; } }
  function jwrite(key, value){ try { localStorage.setItem(key, JSON.stringify(value)); } catch(e){} }
  function lang(){ return document.body?.dataset?.lang || 'en'; }
  function t(en, ar){ return lang() === 'ar' ? ar : en; }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  function setStatus(text, state){
    const box = document.getElementById('adminCommandStatus');
    if (!box) return;
    box.textContent = text || '';
    box.dataset.state = state || '';
  }
  function ensureStyles(){
    if (document.getElementById('final-polish-style')) return;
    const style = document.createElement('style');
    style.id = 'final-polish-style';
    style.textContent = `
      .admin-command-card{position:sticky;top:10px;z-index:25;border:1px solid rgba(53,91,140,.10);background:linear-gradient(180deg,#ffffff 0%,#fbfdff 100%)}
      .admin-command-grid{display:grid;grid-template-columns:minmax(220px,1.4fr) repeat(4,auto);gap:10px;align-items:center}
      .admin-command-grid .ghost-btn,.admin-command-grid .main-btn{border-radius:999px;white-space:nowrap}
      .admin-command-search{min-width:0}
      .admin-command-status{margin-top:10px;padding:10px 12px;border-radius:14px;background:#f6f9ff;color:#355b8c;font-weight:700;display:none}
      .admin-command-status[data-state]{display:block}
      .admin-command-status[data-state="error"]{background:#fff3f3;color:#bf3c3c}
      .admin-command-status[data-state="success"]{background:#eefbf1;color:#1f8f4d}
      .admin-command-status[data-state="info"]{background:#f6f9ff;color:#355b8c}
      .admin-section-hidden{display:none !important}
      .admin-highlight-section{box-shadow:0 0 0 3px rgba(255,154,74,.18) inset}
      .mini-chip-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
      .mini-chip{padding:6px 10px;border-radius:999px;background:#f5f7fb;color:#486484;font-weight:700;font-size:.92rem}
      .floating-top-btn{position:fixed;right:16px;bottom:16px;z-index:30;border:none;border-radius:999px;padding:12px 14px;box-shadow:0 12px 24px rgba(0,0,0,.12);background:#ff9a4a;color:#fff;font-weight:800;cursor:pointer}
      @media (max-width: 900px){
        .admin-command-card{position:static}
        .admin-command-grid{grid-template-columns:1fr 1fr}
        .admin-command-grid input{grid-column:1/-1}
      }
      @media (max-width: 560px){
        .admin-command-grid{grid-template-columns:1fr}
        .floating-top-btn{right:10px;bottom:10px;padding:11px 13px}
      }
    `;
    document.head.appendChild(style);
  }
  function createCommandCenter(){
    if (document.getElementById('adminCommandCenter')) return;
    const host = document.getElementById('adminDashboardContent');
    const firstSection = host?.querySelector('.admin-shortcuts-card');
    if (!host || !firstSection) return;
    const card = document.createElement('section');
    card.className = 'card admin-command-card';
    card.id = 'adminCommandCenter';
    card.innerHTML = `
      <div class="section-head"><h2>${esc(t('Command Center','مركز التحكم'))}</h2></div>
      <div class="admin-command-grid">
        <input id="adminSectionSearch" class="admin-text-input admin-command-search" placeholder="${esc(t('Search admin sections','ابحث داخل أقسام الإدارة'))}">
        <button type="button" class="ghost-btn" id="expandAllAdminBtn">${esc(t('Expand All','فتح الكل'))}</button>
        <button type="button" class="ghost-btn" id="collapseAllAdminBtn">${esc(t('Collapse All','طي الكل'))}</button>
        <button type="button" class="ghost-btn" id="exportAdminBackupBtn">${esc(t('Export Backup','تصدير نسخة احتياطية'))}</button>
        <label class="ghost-btn" style="display:inline-flex;align-items:center;justify-content:center;cursor:pointer">${esc(t('Import Backup','استيراد نسخة'))}<input id="importAdminBackupInput" type="file" accept="application/json" hidden></label>
      </div>
      <div class="mini-chip-row" id="adminSearchChips"></div>
      <div class="admin-command-status" id="adminCommandStatus" aria-live="polite"></div>`;
    host.insertBefore(card, firstSection);
  }
  function getSectionCards(){
    return Array.from(document.querySelectorAll('#adminDashboardContent > section, #adminDashboardContent > .admin-top-grid, #adminDashboardContent > .admin-grid')).filter(Boolean);
  }
  function filterSections(){
    const input = document.getElementById('adminSectionSearch');
    const q = String(input?.value || '').trim().toLowerCase();
    const chips = document.getElementById('adminSearchChips');
    if (chips) chips.innerHTML = '';
    let shown = 0;
    document.querySelectorAll('#adminDashboardContent > section.card').forEach(section => {
      if (section.id === 'adminCommandCenter') return;
      const text = section.textContent.toLowerCase();
      const match = !q || text.includes(q);
      section.classList.toggle('admin-section-hidden', !match);
      section.classList.toggle('admin-highlight-section', !!q && match);
      if (match) shown += 1;
    });
    document.querySelectorAll('#adminDashboardContent > .admin-top-grid, #adminDashboardContent > .admin-grid').forEach(block => {
      const visibleChild = block.querySelector('section.card:not(.admin-section-hidden)');
      block.classList.toggle('admin-section-hidden', !!q && !visibleChild);
    });
    if (chips){
      const chip = document.createElement('span');
      chip.className = 'mini-chip';
      chip.textContent = q ? t('Matches','مطابقات') + ': ' + shown : t('Showing all sections','عرض كل الأقسام');
      chips.appendChild(chip);
    }
  }
  function setAllCollapsed(collapsed){
    if (typeof window.ADMIN_COLLAPSIBLE_CONFIGS === 'undefined' || typeof window.setCollapsed !== 'function') return false;
    window.ADMIN_COLLAPSIBLE_CONFIGS.forEach(cfg => {
      const btn = document.getElementById(cfg.buttonId);
      if (document.getElementById(cfg.bodyId)) window.setCollapsed(cfg.bodyId, btn, collapsed);
    });
    return true;
  }
  function collectBackup(){
    const payload = { exportedAt: new Date().toISOString(), source: 'kg-v38.10-final-polish-pack', data: {} };
    BACKUP_KEYS.forEach(key => {
      const value = localStorage.getItem(key);
      if (value != null) payload.data[key] = value;
    });
    return payload;
  }
  function exportBackup(){
    const payload = collectBackup();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kg-admin-backup.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
    setStatus(t('Backup exported successfully.','تم تصدير النسخة الاحتياطية بنجاح.'), 'success');
  }
  async function importBackup(file){
    try {
      const raw = await file.text();
      const payload = JSON.parse(raw);
      const data = payload && typeof payload === 'object' ? payload.data : null;
      if (!data || typeof data !== 'object') throw new Error('Invalid backup format');
      Object.keys(data).forEach(key => {
        const targetKey = BACKUP_KEYS.includes(key) ? key : (BACKUP_IMPORT_ALIASES[key] || '');
        if (targetKey && typeof data[key] === 'string') localStorage.setItem(targetKey, data[key]);
      });
      setStatus(t('Backup imported. Refreshing the dashboard...','تم استيراد النسخة. يتم تحديث اللوحة...'), 'success');
      setTimeout(() => window.location.reload(), 550);
    } catch (err) {
      setStatus(t('Could not import that backup file.','تعذر استيراد ملف النسخة الاحتياطية.'), 'error');
    }
  }
  function draftFields(){
    return ['testGrade','testName','testMode','testCount','testQuestionList','newQGrade','newQSkill','newQType','newQText','newQOptions','newQAnswer','newQDifficulty','newQImage'];
  }
  function saveDrafts(){
    const draft = jread(DRAFT_KEY, {});
    draftFields().forEach(id => {
      const el = document.getElementById(id);
      if (el) draft[id] = el.value;
    });
    jwrite(DRAFT_KEY, draft);
  }
  function restoreDrafts(){
    const draft = jread(DRAFT_KEY, {});
    draftFields().forEach(id => {
      const el = document.getElementById(id);
      if (el && typeof draft[id] === 'string' && !el.value) el.value = draft[id];
    });
    const chips = document.getElementById('adminSearchChips');
    const used = Object.values(draft).filter(v => String(v || '').trim()).length;
    if (chips && used){
      const chip = document.createElement('span');
      chip.className = 'mini-chip';
      chip.textContent = t('Draft restored','تمت استعادة المسودة');
      chips.appendChild(chip);
    }
  }
  function clearDrafts(){
    localStorage.removeItem(DRAFT_KEY);
    setStatus(t('Saved drafts cleared.','تم مسح المسودات المحفوظة.'), 'info');
  }
  function addTopButton(){
    if (document.getElementById('adminBackToTopBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'adminBackToTopBtn';
    btn.className = 'floating-top-btn';
    btn.type = 'button';
    btn.textContent = '↑';
    btn.title = t('Back to top','العودة للأعلى');
    btn.addEventListener('click', () => window.scrollTo({ top:0, behavior:'smooth' }));
    document.body.appendChild(btn);
  }
  function wire(){
    createCommandCenter();
    restoreDrafts();
    addTopButton();
    document.getElementById('adminSectionSearch')?.addEventListener('input', filterSections);
    document.getElementById('expandAllAdminBtn')?.addEventListener('click', () => {
      if (setAllCollapsed(false)) setStatus(t('All admin sections expanded.','تم فتح كل أقسام الإدارة.'), 'info');
    });
    document.getElementById('collapseAllAdminBtn')?.addEventListener('click', () => {
      if (setAllCollapsed(true)) setStatus(t('All admin sections collapsed.','تم طي كل أقسام الإدارة.'), 'info');
    });
    document.getElementById('exportAdminBackupBtn')?.addEventListener('click', exportBackup);
    document.getElementById('importAdminBackupInput')?.addEventListener('change', e => {
      const file = e.target.files?.[0];
      if (file) importBackup(file);
      e.target.value = '';
    });
    draftFields().forEach(id => {
      const el = document.getElementById(id);
      if (!el || el.dataset.finalPolishDraft === '1') return;
      el.dataset.finalPolishDraft = '1';
      el.addEventListener('input', saveDrafts);
      el.addEventListener('change', saveDrafts);
    });
    document.getElementById('clearTeacherTestBtn')?.addEventListener('click', () => setTimeout(saveDrafts, 50));
    document.getElementById('addQuestionBtn')?.addEventListener('click', () => setTimeout(saveDrafts, 50));
    document.getElementById('saveTeacherTestBtn')?.addEventListener('click', clearDrafts);
    filterSections();
  }
  function boot(){
    ensureStyles();
    const panel = document.getElementById('adminPanel');
    const observer = new MutationObserver(() => {
      if (!panel.classList.contains('hidden')) setTimeout(wire, 160);
    });
    if (panel) observer.observe(panel, { attributes:true, attributeFilter:['class'] });
    if (panel && !panel.classList.contains('hidden')) setTimeout(wire, 160);
  }
  window.addEventListener('load', () => setTimeout(boot, 400));
})();

/* ---- END final-polish-pack.js ---- */


/* ---- BEGIN adaptive-access-admin.js ---- */
(function(){
  if (typeof window === 'undefined') return;
  var BUILTIN_KEYS = ['kg1','kg2','grade1','grade2','grade3','grade4','grade5','grade6'];
  var BUILTIN_LABELS = {kg1:'KG1',kg2:'KG2',grade1:'Grade 1',grade2:'Grade 2',grade3:'Grade 3',grade4:'Grade 4',grade5:'Grade 5',grade6:'Grade 6'};
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(ch){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]; }); }
  function lang(){ try { return typeof window.getLang === 'function' ? window.getLang() : 'en'; } catch(e){ return 'en'; } }
  function t(en, ar){ return lang() === 'ar' ? ar : en; }
  function customClasses(){ try { return typeof window.getCustomClasses === 'function' ? (window.getCustomClasses() || []) : []; } catch(e){ return []; } }
  function uniqueKeys(items){ var out=[]; var seen={}; (items||[]).forEach(function(item){ var key=String(item||'').trim().toLowerCase(); if(!key||seen[key]) return; seen[key]=1; out.push(key); }); return out; }
  function allKeys(){ return uniqueKeys(BUILTIN_KEYS.concat(customClasses().map(function(c){ return c && c.key; }))); }
  function labelFor(key){
    key = String(key || '').trim().toLowerCase();
    var found = customClasses().find(function(c){ return c && c.key === key; });
    return (found && (found.name || found.label)) || BUILTIN_LABELS[key] || key.toUpperCase();
  }
  function getAccess(){ try { return typeof window.getQuizAccess === 'function' ? (window.getQuizAccess() || {}) : {}; } catch(e){ return {}; } }
  function setAccess(v){ try { if (typeof window.setQuizAccess === 'function') window.setQuizAccess(v); } catch(e){} }
  function removeSnapshot(){
    var snap = document.getElementById('studentSummaryUpgrade');
    if (snap) snap.remove();
  }
  function accessGrid(){ return document.querySelector('#quizAccessBody .quiz-password-grid'); }
  function updateQuizAccessCopy(){
    var note = document.querySelector('#quizAccessBody .muted-note[data-i18n="setPasswordInfo"]');
    if (note) note.textContent = t('Set a password for any grade or class. New built-in grades and custom classes appear here automatically. Students will be asked for it before entering the quiz. Leave blank to disable password.', 'يمكنك ضبط كلمة مرور لأي صف أو فصل. ستظهر الصفوف والفصول الجديدة هنا تلقائيًا. سيُطلب من الطالب إدخالها قبل بدء الاختبار. اترك الحقل فارغًا لإلغاء كلمة المرور.');
  }
  window.renderQuizAccessEditor = function(){
    updateQuizAccessCopy();
    var grid = accessGrid();
    if (!grid) return;
    var cfg = getAccess();
    var keys = allKeys();
    grid.innerHTML = keys.map(function(key){
      var entry = cfg[key] || {enabled:false,password:''};
      var checked = entry.enabled && entry.password ? ' checked' : '';
      var title = labelFor(key);
      return '<div class="quiz-password-card">'
        + '<h3>' + esc(title) + '</h3>'
        + '<label class="level-toggle admin-toggle-row"><input type="checkbox" data-quiz-access-grade="' + esc(key) + '" data-role="enabled"' + checked + '><span>'
        + esc(t('Protect ' + title + ' with password', 'حماية ' + title + ' بكلمة مرور'))
        + '</span></label>'
        + '<input class="admin-text-input" data-quiz-access-grade="' + esc(key) + '" data-role="password" placeholder="' + esc(t(title + ' password', 'كلمة مرور ' + title)) + '" value="' + esc(entry.password || '') + '">'
        + '</div>';
    }).join('');
  };
  window.saveQuizAccessFromAdmin = function(){
    var next = getAccess();
    allKeys().forEach(function(key){
      var enabled = document.querySelector('[data-quiz-access-grade="' + key.replace(/"/g,'\\"') + '"][data-role="enabled"]');
      var value = document.querySelector('[data-quiz-access-grade="' + key.replace(/"/g,'\\"') + '"][data-role="password"]');
      var password = String(value && value.value || '').trim();
      next[key] = { enabled: !!(enabled && enabled.checked && password), password: password };
    });
    setAccess(next);
    window.renderQuizAccessEditor();
    alert(t('Quiz password settings saved.', 'تم حفظ إعدادات كلمات المرور للاختبارات.'));
  };
  window.clearQuizAccessFromAdmin = function(){
    var next = getAccess();
    allKeys().forEach(function(key){ next[key] = {enabled:false, password:''}; });
    setAccess(next);
    window.renderQuizAccessEditor();
  };
  function boot(){
    removeSnapshot();
    updateQuizAccessCopy();
    if (document.body && document.body.dataset && document.body.dataset.page === 'admin') {
      if (document.getElementById('adminPanel') && !document.getElementById('adminPanel').classList.contains('hidden')) window.renderQuizAccessEditor();
    }
  }

  document.addEventListener('click', function(event){
    var btn = event.target && event.target.closest ? event.target.closest('#saveClassBtn') : null;
    if (btn) setTimeout(function(){ try { window.renderQuizAccessEditor(); } catch(e){} }, 50);
  });
  document.addEventListener('DOMContentLoaded', boot);
  window.addEventListener('load', boot);
  var mo = new MutationObserver(function(){ removeSnapshot(); });
  document.addEventListener('DOMContentLoaded', function(){ try { mo.observe(document.body, {childList:true, subtree:true}); } catch(e){} });
})();

/* ---- END adaptive-access-admin.js ---- */


/* ---- BEGIN latest-admin-dynamic-fix.js ---- */

(function(){
  if (typeof window === 'undefined') return;
  var BUILTIN_KEYS = ['kg1','kg2','grade1','grade2','grade3','grade4','grade5','grade6'];
  var BUILTIN_LABELS = {
    kg1:'KG1', kg2:'KG2',
    grade1:'Grade 1', grade2:'Grade 2', grade3:'Grade 3', grade4:'Grade 4', grade5:'Grade 5', grade6:'Grade 6'
  };
  function lang(){ try { return typeof window.getLang === 'function' ? window.getLang() : (localStorage.getItem('kgAppLang') || 'en'); } catch(e){ return 'en'; } }
  function t(en, ar){ return lang() === 'ar' ? ar : en; }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(m){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]; }); }
  function readJson(key, fallback){ try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch(e){ return fallback; } }
  function uniq(arr){ var out=[], seen=new Set(); (arr||[]).forEach(function(x){ x=String(x||'').trim().toLowerCase(); if(x && !seen.has(x)){ seen.add(x); out.push(x); }}); return out; }
  function collectCustomClasses(){
    var items = [];
    try {
      if (typeof window.getCustomClasses === 'function') {
        var classes = window.getCustomClasses() || [];
        classes.forEach(function(c){ if (c && (c.key || c.name)) items.push({ key:String(c.key || c.name).trim().toLowerCase(), name:c.name || c.label || c.key }); });
      }
    } catch(e){}
    try {
      var classes2 = readJson('kgEnglishCustomClassesV29', []);
      (classes2 || []).forEach(function(c){ if (c && (c.key || c.name)) items.push({ key:String(c.key || c.name).trim().toLowerCase(), name:c.name || c.label || c.key }); });
    } catch(e){}
    try {
      var qmap = typeof window.getCustomQuestions === 'function' ? window.getCustomQuestions() : {};
      Object.keys(qmap || {}).forEach(function(k){
        if (!BUILTIN_KEYS.includes(String(k).toLowerCase())) items.push({key:String(k).toLowerCase(), name:String(k)});
      });
    } catch(e){}
    try {
      var tests = typeof window.getTeacherTests === 'function' ? window.getTeacherTests() : {};
      Object.keys(tests || {}).forEach(function(k){
        if (!BUILTIN_KEYS.includes(String(k).toLowerCase())) items.push({key:String(k).toLowerCase(), name:String(k)});
      });
    } catch(e){}
    var merged = [];
    var seen = new Set();
    items.forEach(function(c){
      var key = String(c.key||'').trim().toLowerCase();
      if (!key || seen.has(key)) return;
      seen.add(key);
      merged.push({ key:key, name:c.name || key.toUpperCase() });
    });
    return merged;
  }
  function allKeys(){
    var custom = collectCustomClasses().map(function(c){ return c.key; });
    return uniq(BUILTIN_KEYS.concat(custom));
  }
  function labelFor(key){
    key = String(key || '').trim().toLowerCase();
    if (BUILTIN_LABELS[key]) return BUILTIN_LABELS[key];
    var found = collectCustomClasses().find(function(c){ return c.key === key; });
    return found ? String(found.name || key).trim() : key.toUpperCase();
  }

  function ensureTimerMap(base){
    var obj = Object.assign({}, base || {});
    allKeys().forEach(function(k){ if (typeof obj[k] !== 'boolean') obj[k] = true; });
    return obj;
  }
  function ensureAccessMap(base){
    var obj = Object.assign({}, base || {});
    allKeys().forEach(function(k){ if (!obj[k] || typeof obj[k] !== 'object') obj[k] = {enabled:false,password:''}; else { if (typeof obj[k].enabled !== 'boolean') obj[k].enabled = false; if (typeof obj[k].password !== 'string') obj[k].password = ''; } });
    return obj;
  }

  var prevGetTimer = window.getTimerSettings;
  window.getTimerSettings = function(){
    var base = {};
    try { base = prevGetTimer ? prevGetTimer() : readJson('kgEnglishTimerSettingsV23', {}); } catch(e){}
    return ensureTimerMap(base);
  };
  var prevSetTimer = window.setTimerSettings;
  window.setTimerSettings = function(v){
    var next = ensureTimerMap(v);
    if (prevSetTimer) return prevSetTimer(next);
    localStorage.setItem('kgEnglishTimerSettingsV23', JSON.stringify(next));
  };

  var prevGetAccess = window.getQuizAccess;
  window.getQuizAccess = function(){
    var base = {};
    try { base = prevGetAccess ? prevGetAccess() : readJson('kgEnglishQuizAccessV29', {}); } catch(e){}
    return ensureAccessMap(base);
  };
  var prevSetAccess = window.setQuizAccess;
  window.setQuizAccess = function(v){
    var next = ensureAccessMap(v);
    if (prevSetAccess) return prevSetAccess(next);
    sessionStorage.setItem('kgEnglishQuizAccessV29', JSON.stringify(next));
  };

  window.renderTimerSettingsEditor = function(){
    var wrap = document.getElementById('adminTimerSettings');
    if (!wrap) return;
    var note = document.querySelector('#timerSettingsBody .muted-note');
    if (note) note.textContent = t('Turn the timer on or off for each grade from KG1 to Grade 6 and for custom classes. When timer is off, students answer without countdown and each correct answer gives fixed points.','شغّل أو أوقف المؤقت لكل صف من KG1 إلى Grade 6 ولكل الصفوف المخصصة. عند إيقاف المؤقت يجيب الطلاب بدون عدّ تنازلي وتحصل كل إجابة صحيحة على نقاط ثابتة.');
    var cfg = window.getTimerSettings();
    wrap.innerHTML = allKeys().map(function(key){
      var enabled = cfg[key] !== false;
      return '<div class="level-visibility-card">'
        + '<h3>' + esc(labelFor(key)) + '</h3>'
        + '<label class="level-toggle admin-toggle-row">'
        + '<input type="checkbox" data-timer-grade="' + esc(key) + '"' + (enabled ? ' checked' : '') + '>'
        + '<span>' + esc(enabled ? t('Timer enabled','المؤقت يعمل') : t('Timer disabled','المؤقت متوقف')) + '</span>'
        + '</label></div>';
    }).join('');
    wrap.querySelectorAll('input[data-timer-grade]').forEach(function(input){
      input.addEventListener('change', function(){
        var span = input.closest('label') && input.closest('label').querySelector('span');
        if (span) span.textContent = input.checked ? t('Timer enabled','المؤقت يعمل') : t('Timer disabled','المؤقت متوقف');
      });
    });
  };
  window.saveTimerSettingsFromAdmin = function(){
    var result = {};
    allKeys().forEach(function(key){ result[key] = true; });
    document.querySelectorAll('#adminTimerSettings input[data-timer-grade]').forEach(function(input){
      result[String(input.dataset.timerGrade).toLowerCase()] = !!input.checked;
    });
    window.setTimerSettings(result);
    window.renderTimerSettingsEditor();
    alert(t('Timer settings saved.','تم حفظ إعدادات المؤقت.'));
  };
  window.resetTimerSettingsFromAdmin = function(){
    var result = {};
    allKeys().forEach(function(key){ result[key] = true; });
    window.setTimerSettings(result);
    window.renderTimerSettingsEditor();
  };

  window.renderQuizAccessEditor = function(){
    var wrap = document.getElementById('adminQuizAccess');
    if (!wrap) return;
    var note = document.querySelector('#quizAccessBody .muted-note');
    if (note) note.textContent = t('Set a password for any grade or class. New built-in grades and custom classes appear here automatically. Students will be asked for it before entering the quiz. Leave blank to disable password.','اضبط كلمة مرور لأي صف أو فصل. ستظهر الصفوف الأساسية والصفوف المخصصة هنا تلقائيًا. سيُطلب من الطالب إدخالها قبل دخول الاختبار. اترك الحقل فارغًا لإلغاء كلمة المرور.');
    var cfg = window.getQuizAccess();
    wrap.innerHTML = allKeys().map(function(key){
      var rec = cfg[key] || {enabled:false,password:''};
      var label = labelFor(key);
      return '<div class="level-visibility-card">'
        + '<h3>' + esc(label) + '</h3>'
        + '<label class="level-toggle admin-toggle-row">'
        + '<input type="checkbox" id="quizPasswordEnabled_' + esc(key) + '"' + (rec.enabled ? ' checked' : '') + '>'
        + '<span>' + esc(t('Protect ' + label + ' with password', 'حماية ' + label + ' بكلمة مرور')) + '</span>'
        + '</label>'
        + '<input class="admin-text-input" id="quizPasswordValue_' + esc(key) + '" placeholder="' + esc(t(label + ' password', 'كلمة مرور ' + label)) + '" value="' + esc(rec.password || '') + '">'
        + '</div>';
    }).join('');
  };
  window.saveQuizAccessFromAdmin = function(){
    var next = {};
    allKeys().forEach(function(key){
      var enabled = document.getElementById('quizPasswordEnabled_' + key);
      var value = document.getElementById('quizPasswordValue_' + key);
      var pw = value && value.value ? value.value.trim() : '';
      next[key] = { enabled: !!(enabled && enabled.checked && pw), password: pw };
    });
    window.setQuizAccess(next);
    window.renderQuizAccessEditor();
    alert(t('Quiz password settings saved.','تم حفظ إعدادات كلمات مرور الاختبارات.'));
  };
  window.clearQuizAccessFromAdmin = function(){
    var next = {};
    allKeys().forEach(function(key){ next[key] = {enabled:false,password:''}; });
    window.setQuizAccess(next);
    window.renderQuizAccessEditor();
  };

  function refreshAdminEditors(){
    if (!document.body || document.body.dataset.page !== 'admin') return;
    if (document.getElementById('adminTimerSettings')) window.renderTimerSettingsEditor();
    if (document.getElementById('adminQuizAccess')) window.renderQuizAccessEditor();
  }

  document.addEventListener('DOMContentLoaded', function(){
    setTimeout(refreshAdminEditors, 0);
    setTimeout(refreshAdminEditors, 400);
    setTimeout(refreshAdminEditors, 1200);
  });

  window.addEventListener('storage', function(){ setTimeout(refreshAdminEditors, 0); });

  var origInitAdmin = window.initAdmin;
  if (typeof origInitAdmin === 'function') {
    window.initAdmin = function(){
      var result = origInitAdmin.apply(this, arguments);
      setTimeout(refreshAdminEditors, 50);
      return result;
    };
  }
})();

/* ---- END latest-admin-dynamic-fix.js ---- */
