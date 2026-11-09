// Magic-link landing: exchange the PKCE code (or verify token_hash) for a session cookie, then go to the board.
import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const nextParam = searchParams.get('next');
  const next = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/team';
  const fail = (msg: string) => NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(msg)}`);

  const errDesc = searchParams.get('error_description');
  if (errDesc) return fail(errDesc);

  try {
    const sb = await createClient();
    if (code) {
      const { error } = await sb.auth.exchangeCodeForSession(code);
      if (error) return fail(error.message);
    } else if (tokenHash && type) {
      const { error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type });
      if (error) return fail(error.message);
    } else {
      return fail('Sign-in link is missing its code. Request a new link.');
    }
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Sign-in failed');
  }
  return NextResponse.redirect(`${origin}${next}`);
}
