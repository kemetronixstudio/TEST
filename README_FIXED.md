# Dr. Tarek Quiz App

## Included fixes
- Stable admin login flow with duplicate-click protection.
- QR code renders correctly on certificates.
- Play mode cards now drive the actual selected mode.
- Parent dashboard shows a clear backend-required message when the API is missing.
- Homework analytics section is no longer permanently hidden.
- Static/demo and backend bootstrapped admin account added.
- Missing config files added for deployment.
- Missing quiz image placeholders generated for all bundled quiz-bulk assets.

## Bootstrap admin
- Username: `admin`
- Password: `Admin@123`

Change this password immediately after first login.

## Local static preview
```bash
python3 -m http.server 8080
```

## Notes
- The backend APIs under `/api` need a Node/Vercel-style environment to work in production.
- For production, set `ACCESS_ACCOUNTS_SESSION_SECRET` and `ALLOWED_ORIGINS`.


Auth hardening update:
- Frontend hardcoded admin credentials were removed.
- Built-in bootstrap admin now lives in data/builtin-access-accounts.json as a PBKDF2 hash.
- Backend login is required for the bootstrap admin account.
- Default bootstrap login remains admin / Admin@123; change it immediately after first login.
