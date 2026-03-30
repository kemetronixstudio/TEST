
export const keys = {
  lang: 'kgpro_lang',
  accounts: 'kgpro_accounts',
  classes: 'kgpro_classes',
  qOverrides: 'kgpro_question_overrides',
  attempts: 'kgpro_attempts',
  cert: 'kgpro_cert',
  settings: 'kgpro_settings',
  archivedTests: 'kgpro_archived_tests',
  activeTests: 'kgpro_active_tests',
};
export const storage = {
  get(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    }catch(e){ return fallback; }
  },
  set(key, value){ localStorage.setItem(key, JSON.stringify(value)); },
  remove(key){ localStorage.removeItem(key); }
};
