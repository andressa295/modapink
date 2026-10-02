export type DashboardRole = "admin" | "agent" | "user"

export function parseDashboardRole(value: unknown): DashboardRole | null {
  return value === "admin" || value === "agent" || value === "user" ? value : null
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
