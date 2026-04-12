(function(){
  var allowed = ['grade1','grade2','grade3','grade4','grade5','grade6'];
  try {
    var params = new URLSearchParams(location.search);
    var grade = String(params.get('grade') || '').trim().toLowerCase();
    if (!allowed.includes(grade)) {
      document.body.dataset.gradeFallback = '1';
      grade = 'grade1';
      var host = document.querySelector('.status-box') || document.querySelector('main');
      if (host && !document.getElementById('classGradeFallbackNote')) {
        var note = document.createElement('div');
        note.id = 'classGradeFallbackNote';
        note.className = 'muted-note';
        note.textContent = 'Grade parameter missing or invalid. Defaulted to Grade 1.';
        host.insertBefore(note, host.firstChild);
      }
    }
    document.body.dataset.grade = grade;
  } catch (e) {
    document.body.dataset.gradeFallback = '1';
    document.body.dataset.grade = 'grade1';
  }
})();
