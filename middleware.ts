// Auth gate + session refresh (per @supabase/ssr Next.js docs).
// Everything requires login except /login, /auth/*, static assets and /api/* (API routes check auth themselves).
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC = [/^\/login(\/|$)/, /^\/auth(\/|$)/];

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Not configured yet: let pages render; the board/login pages show a clear "not configured" message.
  if (!url || !anonKey) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Do not run code between createServerClient and getUser (refreshes the session token).
  let user = null;
  try {
    user = (await supabase.auth.getUser()).data.user;
  } catch {
    user = null;
  }

  const path = request.nextUrl.pathname;
  if (!user && !PUBLIC.some((re) => re.test(path))) {
    const to = request.nextUrl.clone();
    to.pathname = '/login';
    to.search = '';
    if (path !== '/') to.searchParams.set('next', path);
    const redirect = NextResponse.redirect(to);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }
  return response;
}

export const config = {
  matcher: [
    // Skip Next internals, API routes and static files.
    '/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml|json|pdf|woff2?)$).*)',
  ],
};
