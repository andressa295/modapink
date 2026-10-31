"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, Check } from "lucide-react";
import { getSupabase } from "../../../lib/supabase-client";
import { usePasswordLink } from "../../../components/auth-link-gate";
import "../../../components/auth.css";

export default function Recovery() {
  const link = usePasswordLink();
  const verification = useRef<Promise<void> | null>(null);
  const isInvitation = link?.kind === "invite";
  const [checking, setChecking] = useState(true);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    let live = true;
    async function validateLink() {
      const client = getSupabase();
      const { error: initializationError } = await client.auth.initialize();
      if (link?.mechanism === "invalid" || (link && initializationError)) throw new Error("INVALID_LINK");
      if (link?.mechanism === "token_hash") {
        const { error } = await client.auth.verifyOtp({ token_hash: link.tokenHash!, type: link.kind });
        if (error) throw new Error("INVALID_LINK");
      }
      // PKCE and standard implicit invite fragments are consumed once by SDK
      // initialization. Invite links are not PKCE (the inviter is another browser).
      if (link?.mechanism === "pkce" && new URL(window.location.href).searchParams.has("code")) throw new Error("INVALID_LINK");
      const { data: { user }, error } = await client.auth.getUser();
      if (error || !user) throw new Error("INVALID_LINK");
      // Defining a personal password does not require a factory profile yet.
      window.history.replaceState(null, "", "/auth/recovery");
    }
    // React Strict Mode may run effects twice; consume OTP links just once.
    verification.current ??= validateLink();
    void verification.current.then(() => { if (live) setReady(true); }).catch(() => {
      if (live) {
        window.history.replaceState(null, "", "/auth/recovery");
        setMessage(isInvitation ? "Este convite está inválido ou expirou. Peça à administração um novo link de acesso." : "Este link está inválido ou expirou. Solicite uma nova recuperação no login.");
      }
    }).finally(() => { if (live) setChecking(false); });
    return () => { live = false; };
  }, [isInvitation, link]);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (loading || !ready) return;
    if (password !== confirmation) { setMessage("As senhas precisam ser iguais."); return; }
    if (password.length < 12) { setMessage("Escolha uma senha com pelo menos 12 caracteres."); return; }
    setLoading(true); setMessage("");
    try {
      const { error } = await getSupabase().auth.updateUser({ password });
      if (error) { setMessage("Não foi possível definir a senha. Confira se ela atende à política de segurança ou solicite um novo link."); return; }
      setPassword(""); setConfirmation("");
      await getSupabase().auth.signOut({ scope: "local" });
      setDone(true); setReady(false);
    } catch { setMessage("Não foi possível concluir a alteração agora. Tente novamente."); }
    finally { setLoading(false); }
  }
  return <main className="login-page"><div className="login-glow one" /><div className="login-glow two" /><header className="login-top"><img src="/modapink-logo.png" alt="Moda Pink Atacado" /><span><i /> GESTÃO DA CONFECÇÃO</span></header><div className="login-content"><section className="login-story"><span className="login-eyebrow"><span /> UM NOVO COMEÇO</span><h1>Seu acesso.<br /><em>Do seu jeito.</em></h1><p>Crie uma senha pessoal para acompanhar a sua confecção com segurança.</p></section><section className="login-card" aria-label="Definir senha"><div className="login-card-top"><span className="login-spark">{done ? <Check size={21} /> : <LockKeyhole size={21} />}</span><span className="login-version">MODA PINK · ACESSO</span></div><h2>{done ? "Sua senha está pronta." : (isInvitation ? "Crie sua senha de acesso." : "Defina sua nova senha.")}</h2><p>{done ? "Entre novamente com seu e-mail e a senha que você escolheu." : "Use pelo menos 12 caracteres e mantenha sua senha pessoal."}</p>{checking ? <div className="auth-feedback" role="status">Verificando o link de acesso…</div> : ready ? <form className="login-recovery-form" onSubmit={submit}><label htmlFor="new-password">Nova senha</label><div className="login-input"><LockKeyhole size={17} /><input id="new-password" type={visible ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" required minLength={12} maxLength={128} disabled={loading} /><button type="button" aria-label={visible ? "Ocultar senha" : "Mostrar senha"} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button></div><label className="recovery-field-label" htmlFor="confirm-password">Confirme a nova senha</label><div className="login-input"><LockKeyhole size={17} /><input id="confirm-password" type={visible ? "text" : "password"} value={confirmation} onChange={e => setConfirmation(e.target.value)} autoComplete="new-password" required minLength={12} maxLength={128} disabled={loading} /></div>{message && <div className="auth-feedback" role="alert">{message}</div>}<button className="login-submit" disabled={loading}>{loading ? "Salvando sua senha…" : "Salvar nova senha"}<ArrowRight size={17} /></button></form> : message && <div className="auth-feedback" role="alert">{message}</div>}<Link href="/login" className={done ? "login-submit" : "login-back-link"}>{done ? "Entrar no painel" : <><ArrowLeft size={14} />Voltar ao login</>}</Link></section></div><footer className="login-footer"><span>© {new Date().getFullYear()} Moda Pink.</span><span>Desenvolvido por <span className="agency-mark">phand<span>®</span></span></span></footer></main>;
}
