
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const isPublicPath = (pathname: string) =>
  pathname === '/login' ||
  pathname === '/auth/callback' ||
  pathname === '/demo-access';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Allow the app to load when Supabase environment variables
  // have not been configured yet.
  if (!url || !key) return response;

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

        response = NextResponse.next({ request });

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

  const localDemoEnabled =
    process.env.UNTOLD_LOCAL_DEMO_MODE === 'true';

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
    const requestedNext = request.nextUrl.searchParams.get('next');

    const safeNext =
      requestedNext &&
      requestedNext.startsWith('/') &&
      !requestedNext.startsWith('//')
        ? requestedNext
        : '/';

    return NextResponse.redirect(new URL(safeNext, request.url));
  }

  return response;
}
