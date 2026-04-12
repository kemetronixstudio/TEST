# Dr. Tarek Quiz App

## Included fixes in this bundle
- Local admin login works again on static hosting by validating the embedded hashed bootstrap admin accounts in the browser.
- Frontend hardcoded admin passwords remain removed.
- Local editable staff/admin accounts now save as PBKDF2 hashes instead of plaintext in localStorage.
- Dead `legacyAdminLaunchButton` wiring was retired from the live login path.
- The final account list renderer now uses the correct account variable for Edit / Password / Delete buttons.
- `quizTimerToken` no longer risks a TDZ crash.
- `normalizeQuestionImage` now has one active declaration.
- `svg/school.png` is now included.
- Homework works in static mode with local JSON/localStorage fallback.
- Parent dashboard works in static mode with local homework data fallback.
- Play & Test leaderboard works in static mode with local leaderboard/session fallback.
- Student cloud quiz progress falls back to local storage when `/api/student/*` is unavailable.
- Service worker now precaches bundled `assets/quiz-bulk/*` images and `svg/school.png`.
- `class.html` now defaults to `kg1` if no `?grade=` parameter is provided.
- Committed session secret file was removed from the bundle and runtime secrets now default outside the public web root.

## Bootstrap admins
- Built-in admin accounts are configured in the backend bundle.
- Usernames are `KEMETRONIX` and `Dr. Tarek`.
- Passwords are intentionally not published in this public README.


## Local static preview
```bash
python3 -m http.server 8080
```

Then open:
- `admin.html`
- `class.html` or `class.html?grade=kg1`
- `play.html`
- `homework.html`
- `parent.html`

## Local homework demo student
- Student ID: `1`
- PIN: `1234`

## Deployment notes
- Vercel config is valid for Node serverless functions.
- Node is pinned to `20.x` in `package.json`.
- For production, set `ACCESS_ACCOUNTS_SESSION_SECRET` and `ALLOWED_ORIGINS`.
- For durable rate limiting on Vercel, configure KV/Upstash. Without KV, fallback throttling is runtime-local only and can reset across cold starts.
- Example `ALLOWED_ORIGINS`: `https://your-project.vercel.app,https://your-custom-domain.com`.


Additional notes in this build:
- Local static homework preview now includes optional local demo student registration in the browser.
- Teacher Test Builder now includes the advanced summary container expected by admin-extra.js.
- Legacy timer/archive keys are migrated forward automatically when old localStorage keys are found.
- Student and homework API endpoints now reject malformed JSON with a clear 400 response and apply request throttling.


Additional hardening in this build:
- `/data/*` is blocked by `vercel.json` redirects so built-in account files are not publicly exposed.
- Admin API tokens are kept in `sessionStorage` only; they are no longer persisted to `localStorage`.
- Direct TCP Redis fallback is disabled by default. Use `ENABLE_DIRECT_REDIS_TCP=true` only when you explicitly need it. The preferred backend is KV/Upstash REST.
- Local/static preview now supports local admin auth from the bundled hashed built-in account file.


Production notes:
- Set ALLOWED_ORIGINS to your live site origin (for example https://your-domain.vercel.app).
- Configure KV/Upstash for durable rate limiting and persistent server-side data.
- The /lib and /data paths are blocked in vercel.json for public deployments.


V17 notes:
- Homework student/homework passwords now require PBKDF2-hashed secrets only.
- Homework available requests are rate-limited too.
- Homework countdown now uses a real deadline timestamp to avoid background-tab drift.
- Admin Students Manager now accepts an optional custom Student ID.
- Play grade values are normalized to canonical keys (grade1..grade6).


Additional compatibility fix in this build: JSON API body parsing now works on plain Node-style servers too, not only on pre-parsed Vercel request bodies.
V20 notes:
- Grade 1–6 question pools are now available on first load without depending on a later bulk merge.
- Quiz init now guards itself immediately to avoid double-start races.
- The class/question bank renderer now covers KG1, KG2, Grade 1–6, and custom classes.
- The admin login button is rebound authoritatively at the end of the runtime so older duplicate handlers do not win.
- The quiz timer helper now uses a single grade-duration helper and the stale V21 timer key was aligned to V23.
- The service worker cache version was bumped so clients pick up the revised scripts cleanly.


V21 notes:
- Duplicate admin login button bindings were removed from old patch blocks; the runtime now keeps one final authoritative admin login handler.
- The old v12 play timer block was removed from app-core.js so play timer debugging now points only to play-main.js.
- A sample .env.example file is included for ACCESS_ACCOUNTS_SESSION_SECRET, ALLOWED_ORIGINS, and optional KV/Upstash configuration.
- app-core.js still contains legacy patch history, but the remaining live admin login path is now consolidated to the final secure flow.
