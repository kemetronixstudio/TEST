
import { storage, keys } from './storage.js';

export function getLang(){ return storage.get(keys.lang, 'en'); }
export function setLang(lang){
  storage.set(keys.lang, lang === 'ar' ? 'ar' : 'en');
  document.body.dataset.lang = getLang();
}
export const t = {
  en: {
    teacher:'Dr. TAREK ABDALAZIZ 📞 01032188008',
    homeTitle:'English Quiz Platform',
    homeLead:'Choose a class and start a beautiful, stable quiz experience.',
    start:'Start',
    home:'Home',
    admin:'Admin',
    save:'Save',
    cancel:'Cancel',
    users:'Users & Roles',
    classes:'Classes',
    questions:'Question Bank',
    tests:'Tests',
    bulk:'Bulk Import',
    settings:'Settings',
    studentName:'Student name',
    chooseLevel:'Choose level',
    question:'Question',
    score:'Score',
    time:'Time',
    student:'Student',
    next:'Next',
    finish:'Finish',
    enterStudentName:'Please enter the student name.',
    noQuestions:'No questions available for this selection.',
    accountSaved:'Account saved.',
    accountDeleted:'Account deleted.',
    questionSaved:'Question saved.',
    classSaved:'Class saved.',
    invalidQuestion:'Question is invalid.',
    duplicateFound:'Duplicate question found.',
    preview:'Preview',
    search:'Search',
    filterSkill:'Filter by skill',
    filterClass:'Filter by class',
    editClass:'Edit Class',
    cloneQuiz:'Clone Quiz',
    archive:'Archive',
    existingAccounts:'Existing Accounts',
    hideClass:'Hide class from main page',
  },
  ar: {
    teacher:'Dr. TAREK ABDALAZIZ 📞 01032188008',
    homeTitle:'منصة اختبارات اللغة الإنجليزية',
    homeLead:'اختر الصف وابدأ تجربة اختبار جميلة وثابتة.',
    start:'ابدأ',
    home:'الرئيسية',
    admin:'الإدارة',
    save:'حفظ',
    cancel:'إلغاء',
    users:'المستخدمون والصلاحيات',
    classes:'الصفوف',
    questions:'بنك الأسئلة',
    tests:'الاختبارات',
    bulk:'الاستيراد الجماعي',
    settings:'الإعدادات',
    studentName:'اسم الطالب',
    chooseLevel:'اختر المستوى',
    question:'السؤال',
    score:'النتيجة',
    time:'الوقت',
    student:'الطالب',
    next:'التالي',
    finish:'إنهاء',
    enterStudentName:'من فضلك أدخل اسم الطالب.',
    noQuestions:'لا توجد أسئلة متاحة لهذا الاختيار.',
    accountSaved:'تم حفظ الحساب.',
    accountDeleted:'تم حذف الحساب.',
    questionSaved:'تم حفظ السؤال.',
    classSaved:'تم حفظ الصف.',
    invalidQuestion:'السؤال غير صالح.',
    duplicateFound:'تم العثور على سؤال مكرر.',
    preview:'معاينة',
    search:'بحث',
    filterSkill:'التصفية حسب المهارة',
    filterClass:'التصفية حسب الصف',
    editClass:'تعديل الصف',
    cloneQuiz:'نسخ الاختبار',
    archive:'أرشفة',
    existingAccounts:'الحسابات الحالية',
    hideClass:'إخفاء الصف من الصفحة الرئيسية',
  }
};
export function tr(key){
  return (t[getLang()] && t[getLang()][key]) || (t.en[key] || key);
}
export function applyI18n(){
  document.body.dataset.lang = getLang();
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    el.textContent = tr(key);
  });
  document.querySelectorAll('[data-ph]').forEach(el => {
    const key = el.dataset.ph;
    el.placeholder = tr(key);
  });
}
export function escapeHtml(v){
  return String(v||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
