
import { storage, keys } from './storage.js';

export const baseQuestions = {
  kg1: [
    {grade:'KG1', type:'choice', skill:'Vocabulary', text:'What animal is this?', image:'cat.svg', options:['Dog','Cat','Bird','Fish'], answer:'Cat', difficulty:1},
    {grade:'KG1', type:'true_false', skill:'Letters', text:'Apple starts with the letter A.', options:['True','False'], answer:'True', difficulty:1},
    {grade:'KG1', type:'input', skill:'Phonics', text:'Type the missing letter: c_t', prompt:'c_t', answer:'a', difficulty:1},
    {grade:'KG1', type:'reorder', skill:'Spelling', text:'Reorder the letters to make a word.', answer:'sun', letters:['u','s','n'], difficulty:1},
    {grade:'KG1', type:'choice', skill:'Shapes', text:'Which shape has 3 sides?', options:['Circle','Square','Triangle','Rectangle'], answer:'Triangle', difficulty:1},
    {grade:'KG1', type:'listen', skill:'Listening', text:'Choose the spoken word.', speech:'banana', options:['banana','apple','orange','grape'], answer:'banana', difficulty:1},
    {grade:'KG1', type:'match', skill:'Vocabulary', text:'Match image to word.', image:'apple.svg', options:['apple','car','book','bird'], answer:'apple', difficulty:1},
    {grade:'KG1', type:'choice', skill:'Colors', text:'What color is the sun in children drawings?', options:['Blue','Yellow','Black','Green'], answer:'Yellow', difficulty:1},
    {grade:'KG1', type:'choice', skill:'Numbers', text:'Which number comes after 2?', options:['1','2','3','5'], answer:'3', difficulty:1},
    {grade:'KG1', type:'choice', skill:'Body', text:'Which part do you use to see?', options:['Eyes','Hands','Feet','Nose'], answer:'Eyes', difficulty:1},
  ],
  kg2: [
    {grade:'KG2', type:'choice', skill:'Vocabulary', text:'Which food is healthy?', image:'carrot.svg', options:['Carrot','Candy','Chips','Soda'], answer:'Carrot', difficulty:1},
    {grade:'KG2', type:'true_false', skill:'Grammar', text:'There are three apples. This sentence is correct.', options:['True','False'], answer:'True', difficulty:1},
    {grade:'KG2', type:'input', skill:'Spelling', text:'Type the missing letter: fru_t', prompt:'fru_t', answer:'i', difficulty:1},
    {grade:'KG2', type:'reorder', skill:'Spelling', text:'Reorder letters to make the word.', answer:'food', letters:['o','d','f','o'], difficulty:1},
    {grade:'KG2', type:'choice', skill:'Phonics', text:'Which word starts with H?', options:['Hat','Cat','Pen','Fish'], answer:'Hat', difficulty:1},
    {grade:'KG2', type:'listen', skill:'Listening', text:'Listen and choose.', speech:'truck', options:['head','truck','fish','apple'], answer:'truck', difficulty:1},
    {grade:'KG2', type:'match', skill:'Vocabulary', text:'Match image to word.', image:'banana.svg', options:['banana','orange','carrot','chair'], answer:'banana', difficulty:1},
    {grade:'KG2', type:'choice', skill:'Manners', text:'What should you say when asking for help?', options:['Please','Bye','Run','Jump'], answer:'Please', difficulty:1},
    {grade:'KG2', type:'choice', skill:'Numbers', text:'What comes after 11?', options:['10','12','13','9'], answer:'12', difficulty:1},
    {grade:'KG2', type:'choice', skill:'Body', text:'Which word starts with H and is part of the body?', options:['Head','Leg','Arm','Toe'], answer:'Head', difficulty:1},
  ]
};

export function getClasses(){
  return storage.get(keys.classes, []);
}
export function saveClasses(v){
  storage.set(keys.classes, v);
}
export function getQuestionOverrides(){
  return storage.get(keys.qOverrides, {});
}
export function saveQuestionOverrides(v){
  storage.set(keys.qOverrides, v);
}
export function collectQuestions(grade){
  const g = String(grade || '').toLowerCase();
  const built = baseQuestions[g] ? JSON.parse(JSON.stringify(baseQuestions[g])) : [];
  const over = getQuestionOverrides();
  const extra = Array.isArray(over[g]) ? JSON.parse(JSON.stringify(over[g])) : [];
  return [...built, ...extra];
}
export function allGrades(){
  return ['kg1','kg2', ...getClasses().map(c => c.key)];
}
export function normalizeQuestionText(t){
  return String(t||'').trim().toLowerCase().replace(/\s+/g,' ');
}
export function validateQuestion(q){
  const errors = [];
  if(!q.text || !String(q.text).trim()) errors.push('Missing question text');
  if(!q.answer || !String(q.answer).trim()) errors.push('Missing answer');
  const type = q.type || 'choice';
  if(['choice','match','listen','true_false'].includes(type)){
    if(!Array.isArray(q.options) || q.options.length < 2) errors.push('Need at least 2 options');
    if(Array.isArray(q.options) && !q.options.includes(q.answer)) errors.push('Answer must exist in options');
  }
  if(type === 'input' && String(q.answer).length < 1) errors.push('Missing input answer');
  if(type === 'reorder' && !Array.isArray(q.letters)) errors.push('Missing letters');
  return { valid: errors.length === 0, errors };
}
export function findDuplicates(grade, newText){
  const norm = normalizeQuestionText(newText);
  return collectQuestions(grade).filter(q => normalizeQuestionText(q.text) === norm);
}
