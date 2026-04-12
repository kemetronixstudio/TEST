(function(){
  function syncNote(){
    try {
      var hasData = false;
      ['certStudentName','certGrade','certLevel','certScore'].forEach(function(id){
        var el = document.getElementById(id);
        var value = String(el && el.textContent || '').trim();
        if (value && value.toLowerCase() !== 'student') hasData = true;
      });
      var note = document.getElementById('certEmptyNote');
      if (note) note.classList.toggle('hidden', hasData);
    } catch (e) {}
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(syncNote, 50); }, { once:true });
  } else {
    setTimeout(syncNote, 50);
  }
  window.addEventListener('load', function(){ setTimeout(syncNote, 50); }, { once:true });
})();
