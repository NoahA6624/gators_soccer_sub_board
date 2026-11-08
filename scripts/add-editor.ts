// Grant editor rights. Usage: npx tsx scripts/add-editor.ts someone@ufl.edu
// Adds the email to editor_allowlist (applies on first login) and upgrades an existing profile.
import { scriptAdminClient } from './_supabase-admin';

async function main() {
  const email = (process.argv[2] || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { console.error('Usage: npx tsx scripts/add-editor.ts email@example.com'); process.exit(1); }
  const sb = scriptAdminClient();
  const { error } = await sb.from('editor_allowlist').upsert({ email });
  if (error) throw new Error(`editor_allowlist: ${error.message}`);
  const { data, error: perr } = await sb.from('profiles').update({ role: 'editor' }).ilike('email', email.replace(/[%_\\]/g, '\\$&')).select('user_id');
  if (perr) throw new Error(`profiles: ${perr.message}`);
  console.log(`${email} allowlisted; ${data?.length ? 'existing profile upgraded to editor' : 'no profile yet (becomes editor on first login)'}.`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
