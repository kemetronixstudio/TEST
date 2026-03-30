
import { storage, keys } from './storage.js';
import { applyI18n, getLang, tr } from './ui.js';

function certData(){
  return storage.get(keys.cert, null);
}
function render(){
  applyI18n();
  const data = certData();
  if(!data) return;
  const set = (id, value) => { const el = document.getElementById(id); if(el) el.textContent = value ?? ''; };
  set('certTitle', getLang() === 'ar' ? 'شهادة تقدير' : 'Certificate of Achievement');
  set('certStudent', data.studentName);
  set('certGrade', data.grade);
  set('certLevel', `${data.quizLevel} / ${data.questionCount}`);
  set('certScore', `${data.score} (${data.percent}%)`);
  set('certDate', data.date);
  set('certStrengths', (data.strengths || []).join(', '));
  set('certWeak', (data.weaknesses || []).join(', '));
  set('certAdvice', data.advice);
  set('certResult', data.remark);
  const box = document.getElementById('qrBox');
  if(box){
    box.innerHTML = '';
    const link = location.href.replace('certificate.html','index.html');
    if(window.QRCode){
      new QRCode(box, { text:link, width:110, height:110 });
    }else{
      box.textContent = link;
    }
  }
}
async function pdfBlob(){
  const area = document.getElementById('certificateArea');
  await new Promise(r => setTimeout(r, 200));
  const canvas = await html2canvas(area, {scale:2, useCORS:true, backgroundColor:'#fffdf4'});
  const imgData = canvas.toDataURL('image/png');
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF('p','pt','a4');
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  const ratio = Math.min((pw-36)/canvas.width, (ph-36)/canvas.height);
  const w = canvas.width * ratio, h = canvas.height * ratio;
  pdf.addImage(imgData, 'PNG', (pw-w)/2, 18, w, h);
  return pdf.output('blob');
}
export function initCertificate(){
  render();
  document.getElementById('downloadPdfBtn')?.addEventListener('click', async () => {
    try{
      const blob = await pdfBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'certificate.pdf';
      a.click();
      setTimeout(()=>URL.revokeObjectURL(url), 1500);
    }catch(e){ alert('Could not generate PDF.'); }
  });
  document.getElementById('shareBtn')?.addEventListener('click', async () => {
    const data = certData() || {};
    try{
      const blob = await pdfBlob();
      const file = new File([blob], 'certificate.pdf', {type:'application/pdf'});
      if(navigator.canShare && navigator.canShare({files:[file]})){
        await navigator.share({ files:[file], title:'Certificate', text:`${data.studentName || 'Student'} - ${data.percent || 0}%` });
      }else{
        window.open(`https://wa.me/?text=${encodeURIComponent(`${data.studentName || 'Student'} finished ${data.grade || ''} with ${data.percent || 0}%`)}`,'_blank');
      }
    }catch(e){ alert('Could not share certificate.'); }
  });
}
