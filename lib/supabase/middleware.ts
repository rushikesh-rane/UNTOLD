import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const isPublicPath = (pathname: string) =>
  pathname === '/login' || pathname === '/auth/callback' || pathname === '/demo-access';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Let the app load if environment variables are not configured yet; Supabase
  // auth cannot be evaluated until they are added to .env.local.
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname, search } = request.nextUrl;
  const localDemoEnabled = process.env.UNTOLD_LOCAL_DEMO_MODE === 'true';
  const isLocalDemo = localDemoEnabled && request.cookies.get('untold-local-demo')?.value === 'enabled';

  if (!user && !isLocalDemo && !isPublicPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    loginUrl.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if ((user || isLocalDemo) && pathname === '/login') {
    const requestedNext = request.nextUrl.searchParams.get('next');
    const safeNext = requestedNext && requestedNext.startsWith('/') && !requestedNext.startsWith('//')
      ? requestedNext
      : '/';
    return NextResponse.redirect(new URL(safeNext, request.url));
  }

  return response;
}
