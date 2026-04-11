# Dr. Tarek Quiz App

## Included fixes in this bundle
- Local admin login works again on static hosting by validating the hashed bootstrap admin from `data/builtin-access-accounts.json` in the browser.
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
- Committed session secret file was removed from the bundle.

## Bootstrap admins
- Username: `KEMETRONIX`
- Password: `************`
- Username: `Dr. Tarek`
- Password: `************`

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
