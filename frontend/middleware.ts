import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_ROUTES = ['/login']

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl
  const hasCookie = request.cookies.has('access_token')

  const isPublic = PUBLIC_ROUTES.some((route) => pathname.startsWith(route))

  // Ruta protegida sin cookie → redirigir a login
  if (!isPublic && !hasCookie) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // El middleware no interpreta identidad ni roles. En /login, /auth/me es la
  // fuente de verdad y el cliente redirige a la ruta predeterminada del rol.
  return NextResponse.next()
}

export const config = {
  // Interceptar TODAS las rutas excepto:
  // - archivos estáticos de Next.js
  // - imágenes optimizadas
  // - favicon
  // - carpeta public/images
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images/).*)'],
}
