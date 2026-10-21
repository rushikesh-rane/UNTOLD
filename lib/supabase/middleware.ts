
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { safeNextPath } from '@/lib/security';

const isPublicPath = (pathname: string) =>
  pathname === '/login' ||
  pathname === '/auth/callback' ||
  pathname === '/demo-access';

type CspContext = { nonce: string; csp: string };

export async function updateSession(request: NextRequest, context?: CspContext) {
  // Next.js reads the nonce from the *request's* content-security-policy header and stamps it on its inline
  // scripts. Build the headers fresh each time so cookie updates made below are carried along too.
  const forwardedHeaders = () => {
    const headers = new Headers(request.headers);
    if (context) {
      headers.set('x-nonce', context.nonce);
      headers.set('content-security-policy', context.csp);
    }
    return headers;
  };

  let response = NextResponse.next({ request: { headers: forwardedHeaders() } });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    // In production a missing setting must never mean "let everyone in": refuse to serve instead (fail closed).
    if (process.env.NODE_ENV === 'production') {
      return new NextResponse('This site is not configured yet.', { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
    // In development, allow the app to load before Supabase has been set up.
    return response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },

      setAll(
        cookiesToSet: {
          name: string;
          value: string;
          options?: Parameters<typeof response.cookies.set>[2];
        }[],
      ) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request: { headers: forwardedHeaders() } });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // getClaims() checks the JWT locally (signing keys are cached), so most requests skip the
  // network round trip to Supabase that getUser() makes. Pages and API routes still call
  // getUser() themselves wherever they need a fully verified user. Falls back to getUser()
  // on older supabase-js versions.
  let user: unknown = null;
  if (typeof supabase.auth.getClaims === 'function') {
    const { data } = await supabase.auth.getClaims();
    user = data?.claims ?? null;
  } else {
    user = (await supabase.auth.getUser()).data.user;
  }

  const { pathname, search } = request.nextUrl;

  // The demo bypass skips sign-in entirely, so it is hard-disabled in production builds even if the
  // environment variable is set by mistake.
  const localDemoEnabled =
    process.env.UNTOLD_LOCAL_DEMO_MODE === 'true' &&
    process.env.NODE_ENV !== 'production';

  const isLocalDemo =
    localDemoEnabled &&
    request.cookies.get('untold-local-demo')?.value === 'enabled';

  if (!user && !isLocalDemo && !isPublicPath(pathname)) {
    const loginUrl = request.nextUrl.clone();

    loginUrl.pathname = '/login';
    loginUrl.search = '';
    loginUrl.searchParams.set('next', `${pathname}${search}`);

    return NextResponse.redirect(loginUrl);
  }

  if ((user || isLocalDemo) && pathname === '/login') {
    const safeNext = safeNextPath(request.nextUrl.searchParams.get('next'));

    return NextResponse.redirect(new URL(safeNext, request.url));
  }

  return response;
}
