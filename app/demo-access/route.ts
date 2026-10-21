import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  // This bypass is intended only for a local development demo. Keep the server-side
  // flag disabled in every deployed environment.
  // Never available in a production build, whatever the environment variable says.
  if (process.env.UNTOLD_LOCAL_DEMO_MODE !== 'true' || process.env.NODE_ENV === 'production') {
    return NextResponse.redirect(new URL('/login?demo=disabled', request.url));
  }

  const response = NextResponse.redirect(new URL('/', request.url));
  response.cookies.set('untold-local-demo', 'enabled', {
    httpOnly: true,
    sameSite: 'lax',
    secure: false, // demo mode only runs in local development, over plain http
    path: '/',
    maxAge: 60 * 60 * 8,
  });
  return response;
}

export async function DELETE(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/login', request.url));
  response.cookies.delete('untold-local-demo');
  return response;
}
