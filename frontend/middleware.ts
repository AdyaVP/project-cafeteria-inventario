import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_ROUTES = ['/login']

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl

  const isPublic = PUBLIC_ROUTES.some((route) =>
    pathname.startsWith(route)
  )

  // Usar request.cookies.get() en lugar de .has()
  // para compatibilidad con edge runtime
  const cookie = request.cookies.get('access_token')
  const hasCookie = cookie !== undefined && cookie.value !== ''

  if (!isPublic && !hasCookie) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (pathname === '/login' && hasCookie) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|images/).*)',
  ],
}
