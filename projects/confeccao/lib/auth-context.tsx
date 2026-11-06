"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, RefreshCw, LogOut } from "lucide-react";
import { getSupabase } from "./supabase-client";
import "../components/auth.css";

export type AccessRole = "admin" | "gestao" | "producao" | "qualidade";
export interface AccessProfile { id: string; name: string; role: AccessRole; active: boolean; }
export const roleNames: Record<AccessRole, string> = { admin: "Administração", gestao: "Gestão", producao: "Produção", qualidade: "Qualidade" };
interface AccessContext { profile: AccessProfile; email: string; refresh: () => Promise<void>; signOut: () => Promise<void>; }
const Context = createContext<AccessContext | null>(null);
export function AuthBoundary({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [profile, setProfile] = useState<AccessProfile | null>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const refresh = useCallback(async () => {
    const client = getSupabase();
    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError || !user) { setProfile(null); router.replace("/login"); return; }
    const { data, error: profileError } = await client.rpc("mf_get_profile");
    if (profileError || !data || data.id !== user.id || !data.active || !["admin", "gestao", "producao", "qualidade"].includes(data.role)) {
      setProfile(null);
      throw new Error("Seu acesso à confecção ainda não foi liberado ou foi desativado. Procure a administração.");
    }
    setProfile(data as AccessProfile);
    setEmail(user.email ?? "");
    setError("");
  }, [router]);
  const signOut = useCallback(async () => {
    setChecking(true);
    setProfile(null);
    const { error: signOutError } = await getSupabase().auth.signOut({ scope: "local" });
    if (signOutError) { setError("Não foi possível encerrar a sessão. Tente novamente."); setChecking(false); return; }
    router.replace("/login");
  }, [router]);
  useEffect(() => {
    let active = true;
    let subscription: { unsubscribe: () => void } | undefined;
    async function validate() {
      try { await refresh(); }
      catch (e) { if (active) setError(e instanceof Error ? e.message : "Não foi possível verificar seu acesso. Tente novamente."); }
      finally { if (active) setChecking(false); }
    }
    try {
      const client = getSupabase();
      subscription = client.auth.onAuthStateChange((event) => {
        if (!active) return;
        if (event === "SIGNED_OUT") { setProfile(null); router.replace("/login"); }
        else if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
          setTimeout(() => { if (active) void validate(); }, 0);
        }
      }).data.subscription;
      void validate();
    } catch {
      setError("A conexão da Confecção Moda Pink ainda precisa ser configurada. O painel será liberado após essa etapa.");
      setChecking(false);
    }
    return () => { active = false; subscription?.unsubscribe(); };
  }, [attempt, refresh, router]);
  if (checking) return <div className="access-check"><span className="access-check-mark">MP</span><span className="access-spinner" /><h1>Verificando seu acesso…</h1><p>Preparando a sua confecção.</p></div>;
  if (error || !profile) return <main className="access-check"><span className="access-check-mark"><LockKeyhole size={25} /></span><h1>Acesso à confecção</h1><p role="alert">{error || "Redirecionando para o login…"}</p><div className="access-check-actions"><button className="button secondary" onClick={() => { setChecking(true); setError(""); setAttempt(n => n + 1); }}><RefreshCw size={15} />Tentar novamente</button><button className="button primary" onClick={() => void signOut().catch(() => router.replace("/login"))}><LogOut size={15} />Voltar ao login</button></div></main>;
  return <Context.Provider value={{ profile, email, refresh, signOut }}>{children}</Context.Provider>;
}
export function useAuth() { const value = useContext(Context); if (!value) throw new Error("AuthBoundary não encontrado."); return value; }
