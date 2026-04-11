
function withCors(handler){
  return async function(req, res){
    if (applyCors(req, res)) return;
    return handler(req, res);
  };
}

const { applyCors, checkRateLimit, readJsonBody } = require('../../lib/api-security');
const backend = require('../../lib/student-cloud-backend');

module.exports = withCors(async function handler(req, res) {
    if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
    return;
  }
  try {
    const body = readJsonBody(req);
    const ident = body.identity || body || {};
    const identityKey = String((ident.studentId || ident.identityKey || ident.name || 'guest')).trim().toLowerCase();
    const actionKey = 'student-start:' + identityKey + ':' + String(body.quizKey || body.quizId || body.quiz || '');
    const limited = checkRateLimit(req, actionKey);
    if (!limited.ok) {
      res.statusCode = 429;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'Too many requests. Try again in ' + limited.retryAfter + ' seconds.' }));
      return;
    }
    const result = await backend.getStudentQuiz(body.identity || body, body.quizKey || body.quizId || body.quiz);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, progress: result.progress, result: result.result, quizKey: result.quizKey, identity: result.identity }));
  } catch (error) {
    res.statusCode = error.status || 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: error.message || 'Request failed' }));
  }
});
