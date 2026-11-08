#!/usr/bin/env node
// Fails if any tracked or staged file looks like it contains a secret or a forbidden file type.
// Runs in `npm run check` and CI. Zero dependencies.
import { execSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';

const files = execSync('git ls-files -co --exclude-standard', { encoding: 'utf8' })
  .split('\n').filter(Boolean);

const FORBIDDEN_PATHS = [
  /(^|\/)\.env(\.(?!example$).+)?$/, // .env, .env.local … (not .env.example)
  /(^|\/)\.claude\//,
  /\.(pem|key|p12|pfx)$/i,
];

const PATTERNS = [
  ['JWT (Supabase anon/service key)', /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/],
  ['Supabase secret key', /\bsb_(secret|publishable)_[A-Za-z0-9_-]{20,}/],
  ['Supabase access token', /\bsbp_[a-f0-9]{30,}/],
  ['Vercel token', /\bvercel_[A-Za-z0-9]{20,}|\bVERCEL_TOKEN[ \t]*=[ \t]*\S{10,}/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{30,}/],
  ['Private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['Postgres URL with password', /postgres(ql)?:\/\/[^:\s]+:[^@\s]{6,}@/],
  ['Assigned secret env var', /\b(SUPABASE_SERVICE_ROLE_KEY|SUPABASE_DB_PASSWORD|SUPABASE_ACCESS_TOKEN|OPEN_METEO_API_KEY)[ \t]*=[ \t]*['"]?[A-Za-z0-9_.\-]{12,}/],
];

const problems = [];
for (const f of files) {
  if (FORBIDDEN_PATHS.some((re) => re.test(f))) { problems.push(`${f}: forbidden file must not be committed`); continue; }
  let st; try { st = statSync(f); } catch { continue; }
  if (!st.isFile() || st.size > 2_000_000 || /\.(png|jpg|ico|pdf|xlsx|woff2?)$/i.test(f)) continue;
  const text = readFileSync(f, 'utf8');
  for (const [name, re] of PATTERNS) if (re.test(text)) problems.push(`${f}: possible ${name}`);
}

if (problems.length) {
  console.error('✖ Secret scan failed:\n  ' + problems.join('\n  '));
  console.error('Move secrets to .env.local (gitignored). If a match is a false positive, adjust scripts/check-secrets.mjs.');
  process.exit(1);
}
console.log(`✔ Secret scan clean (${files.length} files)`);
