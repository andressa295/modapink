/** Only password setup flows are accepted here; destinations stay on this app. */
export type PasswordLink = {
  kind: "invite" | "recovery";
  mechanism: "token_hash" | "pkce" | "implicit" | "invalid";
  tokenHash?: string;
};
const callbackKeys = ["code", "token_hash", "type", "sb_flow_id", "access_token", "refresh_token", "expires_in", "expires_at", "token_type", "error", "error_code", "error_description"];
export function readPasswordLink(url: URL): PasswordLink | null {
  const hash = new URLSearchParams(url.hash.slice(1));
  const value = (key: string) => url.searchParams.get(key) ?? hash.get(key);
  const type = value("type");
  const kind = type === "invite" ? "invite" : "recovery";
  if (value("error") || value("error_code")) return { kind, mechanism: "invalid" };
  if (value("token_hash")) return type === "invite" || type === "recovery" ? { kind, mechanism: "token_hash", tokenHash: value("token_hash")! } : { kind, mechanism: "invalid" };
  if (value("code")) return { kind, mechanism: "pkce" };
  if (value("access_token") || value("refresh_token")) return (type === "invite" || type === "recovery") && value("access_token") && value("refresh_token") ? { kind, mechanism: "implicit" } : { kind, mechanism: "invalid" };
  return null;
}
export function passwordLinkDestination(url: URL): string | null {
  if (!readPasswordLink(url)) return null;
  const query = new URLSearchParams(); const fragment = new URLSearchParams();
  const originalFragment = new URLSearchParams(url.hash.slice(1));
  for (const key of callbackKeys) {
    const q = url.searchParams.get(key); const h = originalFragment.get(key);
    if (q !== null) query.set(key, q);
    if (h !== null) fragment.set(key, h);
  }
  return "/auth/recovery" + (query.size ? `?${query.toString()}` : "") + (fragment.size ? `#${fragment.toString()}` : "");
}
export function callbackAuthFlow(url: URL): "implicit" | "pkce" {
  return readPasswordLink(url)?.mechanism === "implicit" ? "implicit" : "pkce";
}
