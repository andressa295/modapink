"use client";
import { AgencyCredit } from "./agency-credit";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Mail, LockKeyhole, Sparkles, Scissors, Layers, Check, ArrowUpRight, ArrowLeft } from "lucide-react";
import { getSupabase } from "../lib/supabase-client";
import "./auth.css";

export default function Login() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (loading) return;
    setLoading(true); setMessage(""); setSent(false);
    try {
      const client = getSupabase();
      if (recovering) {
        const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/auth/recovery` });
        if (error) throw error;
        setSent(true);
        setMessage("Se este e-mail tiver um acesso cadastrado, você receberá as instruções para definir uma nova senha.");
      } else {
        const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (error || !data.user) throw error ?? new Error("LOGIN_FAILED");
        const { data: profile, error: profileError } = await client.rpc("mf_get_profile");
        if (profileError || !profile?.active || !["admin", "gestao", "producao", "qualidade"].includes(profile.role)) {
          await client.auth.signOut({ scope: "local" });
          setMessage("Seu acesso à confecção ainda não foi liberado ou foi desativado. Procure a administração.");
          return;
        }
        setPassword("");
        router.replace("/dashboard");
      }
    } catch (error) {
      const failure = error as { code?: string; message?: string; status?: number };
      if (failure.code === "invalid_credentials" || failure.status === 400) setMessage("Não foi possível entrar com esses dados. Confira seu e-mail e senha.");
      else if (failure.status === 429) setMessage("Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.");
      else if (/configur|SUPABASE|conexão.*banco/i.test(failure.message ?? "")) setMessage("O acesso ainda aguarda a conexão ao banco da Confecção Moda Pink. A administração precisa concluir essa configuração.");
      else setMessage(recovering ? "Não foi possível solicitar a recuperação agora. Tente novamente em alguns minutos." : "Não foi possível conectar ao acesso da confecção. Tente novamente em alguns minutos.");
    } finally { setLoading(false); }
  }
  function switchMode() { setRecovering(value => !value); setMessage(""); setSent(false); setPassword(""); }
  return <main className="login-page"><div className="login-glow one" /><div className="login-glow two" /><div className="login-grain" />
    <header className="login-top login-top-single"><span><i /> GESTÃO DA CONFECÇÃO</span></header>
    <div className="login-content"><section className="login-story" aria-label="Moda Pink, gestão da confecção"><div className="login-hero-brand"><img src="/modapink-logo.png" alt="Moda Pink Atacado" /></div><div className="login-steps"><span><Layers size={17} /> Matéria-prima</span><i /><span><Scissors size={17} /> Produção</span><i /><span><Check size={17} /> Qualidade</span></div><div className="login-mini"><div className="login-mini-icon"><Scissors size={20} /></div><div><strong>Cuidado em cada etapa.</strong><span>Mais visibilidade. Menos desperdício.</span></div><ArrowUpRight size={19} /></div></section>
      <section className="login-card" aria-label="Acesso ao sistema"><div className="login-card-top"><span className="login-spark">{recovering ? <LockKeyhole size={21} /> : <Sparkles size={21} />}</span><span className="login-version">MODA PINK · PRODUÇÃO</span></div><h2>{recovering ? "Vamos recuperar seu acesso." : "Bem-vinda à sua confecção."}</h2><p>{recovering ? "Enviaremos as instruções para o seu e-mail cadastrado." : "Entre com o acesso liberado para a sua equipe."}</p>
        <form onSubmit={submit}><label htmlFor="auth-email">E-mail</label><div className="login-input"><Mail size={17} /><input id="auth-email" type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="seu@email.com" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} disabled={loading} maxLength={254} /></div>
          {!recovering && <><div className="login-password-label"><label htmlFor="auth-password">Senha</label><button type="button" onClick={switchMode} disabled={loading}>Esqueci minha senha</button></div><div className="login-input"><LockKeyhole size={17} /><input id="auth-password" autoCapitalize="none" autoCorrect="off" spellCheck={false} type={visible ? "text" : "password"} placeholder="Sua senha" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} disabled={loading} /><button type="button" aria-label={visible ? "Ocultar senha" : "Mostrar senha"} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></>}
          {message && <div className={`auth-feedback ${sent ? "success" : ""}`} role={sent ? "status" : "alert"}>{message}</div>}
          <button className="login-submit" type="submit" disabled={loading || (recovering && sent)}>{loading ? "Aguarde um instante…" : recovering ? (sent ? "Instruções solicitadas" : "Recuperar acesso") : "Entrar no painel"}<ArrowRight size={17} /></button>
        </form>{recovering && <button className="login-back-link" onClick={switchMode} disabled={loading}><ArrowLeft size={14} />Voltar para o login</button>}<div className="login-auth-footer"><LockKeyhole size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: 5 }} />Acesso exclusivo à equipe autorizada da Confecção Moda Pink.</div>
      </section></div><footer className="login-footer"><span>© {new Date().getFullYear()} Moda Pink. Feito para crescer com você.</span><AgencyCredit onDark /></footer>
  </main>;
}
