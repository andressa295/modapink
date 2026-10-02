import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { canAccessDashboard, dashboardHome } from "@/lib/dashboard-access"
import { getDashboardAccess } from "@/lib/dashboard-auth"

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return NextResponse.redirect(new URL("/login", request.url))

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      }
    }
  })
  const access = await getDashboardAccess(supabase)
  if (access.role && canAccessDashboard(access.role, request.nextUrl.pathname)) return response

  const destination = access.role ? dashboardHome(access.role) : "/login"
  const target = new URL(destination, request.url)
  target.search = ""
  const redirect = NextResponse.redirect(target)
  response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie))
  return redirect
}

export const config = { matcher: ["/dashboard/:path*"] }
