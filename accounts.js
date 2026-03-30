
import { storage, keys } from './storage.js';

export const PERMISSIONS = [
  'dashboard','users','classes','questions','bulk','tests','settings'
];

const BUILT_INS = [
  { user:'dr. tarek', pass:'T01032188008', role:'admin', permissions:[...PERMISSIONS], builtIn:true, display:'Dr. Tarek' },
  { user:'hitman', pass:'01002439054', role:'admin', permissions:[...PERMISSIONS], builtIn:true, display:'HITMAN' }
];

export function normalizeUser(v){
  return String(v||'').trim().toLowerCase();
}
export function builtInAdmins(){
  return JSON.parse(JSON.stringify(BUILT_INS));
}
export function getAccounts(){
  return storage.get(keys.accounts, []);
}
export function saveAccounts(v){
  storage.set(keys.accounts, v);
}
export function login(user, pass){
  const u = normalizeUser(user);
  const p = String(pass||'').trim();
  const built = builtInAdmins().find(a => normalizeUser(a.user) === u || normalizeUser(a.display) === u);
  if (built && built.pass === p) return built;
  return getAccounts().find(a => normalizeUser(a.user) === u && String(a.pass||'').trim() === p) || null;
}
export function upsertAccount(account){
  const all = getAccounts();
  const u = normalizeUser(account.user);
  const idx = all.findIndex(a => normalizeUser(a.user) === u);
  if (idx >= 0) all[idx] = account; else all.push(account);
  saveAccounts(all);
}
export function deleteAccount(user){
  saveAccounts(getAccounts().filter(a => normalizeUser(a.user) !== normalizeUser(user)));
}
