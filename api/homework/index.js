const backend = require('../../lib/homework-backend');
const access = require('../../lib/access-accounts-backend');
const { applyCors, setAuthCookie, checkRateLimit, readJsonBody } = require('../../lib/api-security');


function withCors(handler){
  return async function(req, res){
    if (applyCors(req, res)) return;
    return handler(req, res);
  };
}

module.exports = withCors(async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');
  try {
    const url = new URL(req.url || '/api/homework', 'http://localhost');
    const action = String(url.searchParams.get('action') || '').trim().toLowerCase();
    const body = readJsonBody(req);
    const isStudentAction = action === 'available' || action === 'start' || action === 'submit' || action === 'identify-student' || action === 'parent-summary';
    if (!isStudentAction) {
      const auth = await access.requireAuthorized(req, 'teacherTest');
      if (!auth.ok) {
        res.statusCode = auth.status;
        res.end(JSON.stringify({ ok:false, error:auth.error }));
        return;
      }
      setAuthCookie(req, res, auth.token);
    }

    if (req.method === 'GET') {
      if (action === 'reports') {
        const data = await backend.listReports({
          q: url.searchParams.get('q') || '',
          className: url.searchParams.get('className') || '',
          grade: url.searchParams.get('grade') || '',
          fromDate: url.searchParams.get('fromDate') || '',
          toDate: url.searchParams.get('toDate') || '',
          homeworkId: url.searchParams.get('homeworkId') || ''
        });
        res.statusCode = 200; res.end(JSON.stringify(data)); return;
      }
      if (action === 'report-detail') {
        const data = await backend.reportDetail(url.searchParams.get('id') || '');
        res.statusCode = 200; res.end(JSON.stringify(data)); return;
      }
      if (action === 'list-students') {
        const data = await backend.listStudents({ q: url.searchParams.get('q') || '' });
        res.statusCode = 200; res.end(JSON.stringify(data)); return;
      }
      if (action === 'analytics') {
        const data = await backend.analytics({
          className: url.searchParams.get('className') || '',
          grade: url.searchParams.get('grade') || '',
          fromDate: url.searchParams.get('fromDate') || '',
          toDate: url.searchParams.get('toDate') || ''
        });
        res.statusCode = 200; res.end(JSON.stringify(data)); return;
      }
      const data = await backend.list();
      res.statusCode = 200; res.end(JSON.stringify(data)); return;
    }

    if (req.method === 'POST') {
      if (action === 'identify-student') {
        const limited = await checkRateLimit(req, 'homework-identify:' + String(body.studentId || body.id || '').trim().toLowerCase());
        if (!limited.ok) { res.statusCode = 429; res.end(JSON.stringify({ ok:false, error:'Too many attempts. Try again in ' + limited.retryAfter + ' seconds.' })); return; }
        const data = await backend.identifyStudent(body);
        res.statusCode = 200; res.end(JSON.stringify(data)); return;
      }
      if (action === 'parent-summary') {
        const limited = await checkRateLimit(req, 'homework-parent:' + String(body.studentId || '').trim().toLowerCase());
        if (!limited.ok) { res.statusCode = 429; res.end(JSON.stringify({ ok:false, error:'Too many attempts. Try again in ' + limited.retryAfter + ' seconds.' })); return; }
        const data = await backend.parentSummary(body);
        res.statusCode = 200; res.end(JSON.stringify(data)); return;
      }
      if (action === 'save-student') {
        const auth = await access.requireAuthorized(req, 'teacherTest');
        if (!auth.ok) { res.statusCode = auth.status; res.end(JSON.stringify({ ok:false, error:auth.error })); return; }
        setAuthCookie(req, res, auth.token);
        const data = await backend.saveStudent(body);
        res.statusCode = 200; res.end(JSON.stringify(data)); return;
      }
      if (action === 'available') {
        const data = await backend.listForStudent(body.identity || body);
        res.statusCode = 200; res.end(JSON.stringify(data)); return;
      }
      if (action === 'start') {
        const limited = await checkRateLimit(req, 'homework-start:' + String(body.identity && body.identity.studentId || '').trim().toLowerCase() + ':' + String(body.homeworkId || '').trim());
        if (!limited.ok) { res.statusCode = 429; res.end(JSON.stringify({ ok:false, error:'Too many start requests. Try again in ' + limited.retryAfter + ' seconds.' })); return; }
        const data = await backend.start(body);
        res.statusCode = 200; res.end(JSON.stringify(data)); return;
      }
      if (action === 'submit') {
        const limited = await checkRateLimit(req, 'homework-submit:' + String(body.identity && body.identity.studentId || '').trim().toLowerCase() + ':' + String(body.homeworkId || '').trim());
        if (!limited.ok) { res.statusCode = 429; res.end(JSON.stringify({ ok:false, error:'Too many submit requests. Try again in ' + limited.retryAfter + ' seconds.' })); return; }
        const data = await backend.submit(body);
        res.statusCode = 200; res.end(JSON.stringify(data)); return;
      }
      const data = await backend.save(body);
      res.statusCode = 200; res.end(JSON.stringify(data)); return;
    }

    if (req.method === 'DELETE') {
      const auth = await access.requireAuthorized(req, 'teacherTest');
      if (!auth.ok) { res.statusCode = auth.status; res.end(JSON.stringify({ ok:false, error:auth.error })); return; }
      setAuthCookie(req, res, auth.token);
      if (action === 'delete-student') {
        const data = await backend.deleteStudent({ id: body.id || body.studentId || url.searchParams.get('id') || '' });
        res.statusCode = 200; res.end(JSON.stringify(data)); return;
      }
      const data = await backend.remove(body.id || url.searchParams.get('id') || '');
      res.statusCode = 200; res.end(JSON.stringify(data)); return;
    }

    res.statusCode = 405; res.end(JSON.stringify({ ok:false, error:'Method not allowed' }));
  } catch (error) {
    res.statusCode = error.status || 400; res.end(JSON.stringify({ ok:false, error:error.message || 'Request failed' }));
  }
});
