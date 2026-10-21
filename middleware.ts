import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { buildCsp, CSP_HEADER } from '@/lib/csp';

export async function middleware(request: NextRequest) {
  // A fresh, unguessable value for every request. See lib/csp.ts.
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);

  const response = await updateSession(request, { nonce, csp });
  response.headers.set(CSP_HEADER, csp);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|theme-init.js|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
