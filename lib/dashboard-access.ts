export type DashboardRole = "admin" | "agent" | "user"

export function parseDashboardRole(value: unknown): DashboardRole | null {
  return value === "admin" || value === "agent" || value === "user" ? value : null
}

// Call only with the profile role returned by getDashboardAccess, never a
// client-supplied role. Messaging access does not grant administration access.
export function canAccessMessaging(role: unknown) {
  return parseDashboardRole(role) !== null
}

export function dashboardHome(role: DashboardRole) {
  return role === "admin" ? "/dashboard" : "/dashboard/conversas"
}

export function canAccessDashboard(role: unknown, pathname: string) {
  const validRole = parseDashboardRole(role)
  if (!validRole) return false
  const path = pathname.replace(/\/+$/, "")
  if (path !== "/dashboard" && !path.startsWith("/dashboard/")) return false
  return validRole === "admin" || path === "/dashboard/conversas"
}
