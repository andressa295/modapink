"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Database, LockKeyhole, Image, UsersRound, ShieldCheck, Check, RefreshCw, Pencil, LogOut, ArrowUpRight, UserPlus, Mail, Send, CircleCheck, Clock3, TriangleAlert, Trash2 } from "lucide-react";
import { useAuth, roleNames, type AccessRole } from "../../../lib/auth-context";
import { getSupabase } from "../../../lib/supabase-client";
import { removeRecord } from "../../../lib/record-removal";
import { useDemo } from "../../../lib/demo-store";
import { requestUuid } from "../../../lib/production-contract";
import { listTeamMembers, sendTeamAccess, TeamAccessError, teamAccessRequestSchema, type TeamMember, type TeamAccessRequest } from "../../../lib/team-access";
import { Modal, PageHeading, PanelTitle, Empty } from "../../../components/ui";
import "../../../components/auth.css";
import "../../../components/team-access.css";

const roleHelp: Record<AccessRole, string> = {
  admin: "Gerencia a equipe, os acessos e todas as áreas do sistema.",
  gestao: "Acompanha a operação, os custos e as confecções parceiras.",
  producao: "Organiza materiais, modelos e o andamento da produção.",
  qualidade: "Registra conferências, defeitos e liberação de retrabalho.",
};
type AccessDialog = { kind: "invite" } | { kind: "resend" | "recovery"; member: TeamMember };
const emptyInvite = { fullName: "", email: "", role: "producao" as AccessRole };
function memberStatus(member: TeamMember) {
  if (!member.active || member.status === "inactive") return { label: "Desativado", tone: "gray", help: "A pessoa não pode acessar o painel." };
  if (member.status === "active") return { label: "Ativo", tone: "green", help: "E-mail confirmado e senha definida." };
  if (member.status === "awaiting_password") return { label: "Aguardando senha", tone: "amber", help: "A pessoa ainda precisa definir sua senha pelo link recebido." };
  return { label: "Convite enviado", tone: "purple", help: "Aguardando a pessoa abrir o e-mail e criar a senha." };
}

export default function Settings() {
  const { profile, email, refresh, signOut } = useAuth();
  const { notify, refresh: refreshFactory } = useDemo();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [teamError, setTeamError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<TeamMember | null>(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [removingMember, setRemovingMember] = useState<TeamMember | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState("");
  const removingRef = useRef(false);
  const [signingOut, setSigningOut] = useState(false);
  const [dialog, setDialog] = useState<AccessDialog | null>(null);
  const [invite, setInvite] = useState(emptyInvite);
  const [accessError, setAccessError] = useState("");
  const [sending, setSending] = useState(false);
  const [endingAttempt, setEndingAttempt] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<TeamAccessRequest | null>(null);
  const sendingRef = useRef(false);
  const pendingRef = useRef<TeamAccessRequest | null>(null);
  const dialogRef = useRef<AccessDialog | null>(null);
  const loadSequence = useRef(0);
  const canManage = profile.role === "admin";
  const canList = canManage || profile.role === "gestao";
  const loadMembers = useCallback(async () => {
    const sequence = ++loadSequence.current;
    if (!canList) { setMembers([]); setLoading(false); setLoaded(false); return; }
    setLoading(true); setTeamError("");
    try {
      const result = await listTeamMembers();
      if (sequence === loadSequence.current) { setMembers(result); setLoaded(true); }
    } catch (cause) {
      if (sequence === loadSequence.current) setTeamError(cause instanceof Error ? cause.message : "Não foi possível carregar a equipe. Tente novamente.");
    } finally { if (sequence === loadSequence.current) setLoading(false); }
  }, [canList, profile.id]);
  useEffect(() => { void loadMembers(); return () => { loadSequence.current += 1; }; }, [loadMembers]);
  function openAccess(next: AccessDialog) {
    if (!canManage || pendingRef.current || sendingRef.current || removingRef.current) return;
    setNotice(""); setAccessError(""); setEndingAttempt(false); setInvite(emptyInvite); setDialog(next); dialogRef.current = next;
  }
  function closeAccess() {
    if (sendingRef.current) return;
    setDialog(null); setEndingAttempt(false);
    if (pendingRef.current) setNotice("Há um envio aguardando confirmação. Retome a solicitação para verificar o resultado antes de cadastrar outra pessoa.");
    else { setAccessError(""); dialogRef.current = null; }
  }
  function resumeAccess() { if (pendingRef.current && dialogRef.current) { setDialog(dialogRef.current); setNotice(""); } }
  async function endAttempt() {
    if (sendingRef.current || !pendingRef.current || !endingAttempt) return;
    pendingRef.current = null; setPendingRequest(null); dialogRef.current = null;
    setDialog(null); setEndingAttempt(false); setAccessError(""); setInvite(emptyInvite);
    setNotice("Tentativa encerrada neste navegador. O e-mail pode já ter sido enviado. Confira a lista antes de solicitar outro envio.");
    await loadMembers();
  }
  async function submitAccess(event: React.FormEvent) {
    event.preventDefault(); if (!canManage || !dialog || sendingRef.current) return;
    let request = pendingRef.current;
    if (!request) {
      const candidate = dialog.kind === "invite" ? { action: "invite" as const, requestId: requestUuid(), ...invite } : { action: dialog.kind, requestId: requestUuid(), userId: dialog.member.id };
      const parsed = teamAccessRequestSchema.safeParse(candidate);
      if (!parsed.success) { setAccessError(parsed.error.issues[0]?.message ?? "Confira os dados da pessoa."); return; }
      request = parsed.data; pendingRef.current = request; setPendingRequest(request);
    }
    sendingRef.current = true; setSending(true); setAccessError(""); setEndingAttempt(false);
    try {
      const result = await sendTeamAccess(request);
      const sentEmail = dialog.kind === "invite" ? (request.action === "invite" ? request.email : invite.email) : dialog.member.email;
      pendingRef.current = null; setPendingRequest(null); dialogRef.current = null; setDialog(null); setInvite(emptyInvite);
      setNotice(result.message ?? (request.action === "recovery" ? `Instruções de recuperação enviadas para ${sentEmail}.` : `Convite enviado para ${sentEmail}. A pessoa abre o e-mail e define a própria senha.`));
      await loadMembers();
    } catch (cause) {
      const failure = cause instanceof TeamAccessError ? cause : new TeamAccessError("Não foi possível confirmar o envio. Reconfirme a mesma solicitação.", { uncertain: true });
      setAccessError(failure.message);
      if (!failure.uncertain) { pendingRef.current = null; setPendingRequest(null); }
    } finally { sendingRef.current = false; setSending(false); }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (!canManage || !selected || saving) return;
    const name = selected.full_name.trim();
    if (!name) { setEditError("Informe o nome da pessoa."); return; }
    setSaving(true); setEditError("");
    try {
      const { error } = await getSupabase().rpc("mf_set_profile", { p_user_id: selected.id, p_full_name: name, p_role: selected.role, p_active: selected.active });
      if (error) { setEditError("Não foi possível alterar esse acesso. Confira sua permissão e mantenha ao menos uma pessoa da administração ativa."); return; }
      setSelected(null); await loadMembers(); await refresh(); setNotice("Acesso da equipe atualizado.");
    } catch { setEditError("Não foi possível atualizar o acesso agora. Tente novamente."); }
    finally { setSaving(false); }
  }
  async function removeMember() {
    const target = removingMember;
    if (!canManage || !target || removingRef.current) return;
    if (target.id === profile.id) { setRemoveError("Você não pode excluir seu próprio acesso."); return; }
    removingRef.current = true; setRemoving(true); setRemoveError("");
    try {
      await removeRecord("member", target.id);
      setMembers(current => current.filter(member => member.id !== target.id));
      setRemovingMember(null); setNotice("Pessoa excluída da equipe. O acesso ao painel foi encerrado.");
      await Promise.allSettled([loadMembers(), refreshFactory(), refresh()]);
    } catch (cause) { setRemoveError(cause instanceof Error ? cause.message : "Não foi possível excluir esse acesso. Tente novamente."); }
    finally { removingRef.current = false; setRemoving(false); }
  }
  async function leave() { if (signingOut) return; setSigningOut(true); try { await signOut(); } catch { notify("Não foi possível sair agora. Tente novamente."); } finally { setSigningOut(false); } }
  const pending = !!pendingRequest;
  const listUnavailable = !loaded || loading || !!teamError || removing;
  return <>
    <PageHeading eyebrow="CONFIGURAÇÕES" title="Sua equipe. Cada acesso no lugar." description="Cadastre as pessoas e escolha o que cada uma pode acessar.">
      {canManage && <button className="button primary" disabled={listUnavailable || pending} onClick={() => openAccess({ kind: "invite" })}><UserPlus size={16} />Cadastrar pessoa</button>}
    </PageHeading>
    {notice && <div className={`team-page-feedback ${pending ? "pending" : "success"}`} role="status">{pending ? <Clock3 size={17} /> : <CircleCheck size={17} />}<p>{notice}</p>{pending && !dialog && <button type="button" onClick={resumeAccess}>Retomar envio</button>}</div>}
    <section className="settings-grid"><div className="settings-main">
      <section className="panel"><PanelTitle title="Minha conta" subtitle="Seu acesso individual à Confecção Moda Pink" /><div className="settings-description"><span className="settings-big-icon"><ShieldCheck size={26} /></span><div><h3 className="settings-account-name">{profile.name || "Integrante da equipe"}</h3><p className="settings-account-email">{email}</p></div></div><div className="settings-facts"><div><span>Perfil de acesso</span><strong>{roleNames[profile.role]}</strong></div><div><span>Situação da conta</span><strong>Ativa</strong></div><div><span>Unidade</span><strong>Confecção Moda Pink</strong></div></div><div className="settings-account-actions"><Link className="button secondary" href="/auth/recovery"><LockKeyhole size={15} />Alterar minha senha</Link><button className="button secondary" onClick={() => void leave()} disabled={signingOut}><LogOut size={15} />{signingOut ? "Encerrando…" : "Sair da conta"}</button></div></section>
      <section className="panel team-members-panel"><PanelTitle title="Equipe e convites" subtitle={canManage ? "Um cadastro simples. Um acesso para cada pessoa." : "Pessoas e perfis autorizados na confecção."} action={canList ? <button className="team-refresh" aria-label="Atualizar lista da equipe" disabled={loading || sending} onClick={() => void loadMembers()}><RefreshCw size={14} className={loading ? "team-spinning" : undefined} />Atualizar</button> : undefined} />
        {canManage && <div className="team-invite-guide" aria-label="Como cadastrar a equipe"><span><b>1</b>Cadastre nome e e-mail</span><span><b>2</b>Escolha o perfil</span><span><b>3</b>A pessoa cria a senha pelo e-mail</span></div>}
        {!canList ? <div className="settings-inline-feedback">Seu perfil permite consultar sua própria conta. A administração cadastra e libera os demais acessos.</div> : <>
          {teamError && <div className="team-list-error" role="alert"><TriangleAlert size={16} /><p>{teamError}{loaded ? " Os dados abaixo são da última consulta concluída." : ""}</p><button type="button" onClick={() => void loadMembers()} disabled={loading}>Tentar novamente</button></div>}
          {loading && <div className="settings-inline-feedback" role="status">{loaded ? "Atualizando a equipe…" : "Carregando a equipe…"}</div>}
          {loaded && members.length > 0 && <div className="table-scroll"><table className="data-table team-table team-access-table"><thead><tr><th>Pessoa</th><th>Perfil</th><th>Acesso</th>{canManage && <th>Ações</th>}</tr></thead><tbody>{members.map(member => { const status = memberStatus(member); return <tr key={member.id}><td data-label="Pessoa"><strong className="team-member-name">{member.full_name || "Nome não informado"}</strong><span className="team-member-email">{member.email || "E-mail não disponível"}</span>{member.id === profile.id && <small className="team-self">Sua conta</small>}</td><td data-label="Perfil"><span className="team-role">{roleNames[member.role]}</span></td><td data-label="Acesso"><span className={`badge ${status.tone}`} title={status.help}><i />{status.label}</span><small className="team-status-help">{status.help}</small></td>{canManage && <td data-label="Ações"><div className="team-member-actions"><button type="button" className="team-action-button" disabled={listUnavailable || pending} aria-label={`Editar acesso de ${member.full_name || "integrante"}`} onClick={() => { setEditError(""); setSelected({ ...member }); }}><Pencil size={13} />Editar</button>{member.active && member.email && member.id !== profile.id && <button type="button" className="team-action-button" disabled={listUnavailable || pending} onClick={() => openAccess({ kind: member.password_set ? "recovery" : "resend", member })}><Mail size={13} />{member.password_set ? "Recuperar senha" : "Reenviar convite"}</button>}{member.id !== profile.id && <button type="button" className="team-action-button team-remove-button" disabled={listUnavailable || pending} onClick={() => { setRemoveError(""); setRemovingMember(member); }}><Trash2 size={13} />Excluir</button>}</div></td>}</tr>; })}</tbody></table></div>}
          {loaded && !members.length && !loading && !teamError && <Empty title="Vamos reunir sua equipe?" text="Cadastre a primeira pessoa. Ela receberá um convite para criar a própria senha." action={canManage ? <button className="button primary" disabled={pending} onClick={() => openAccess({ kind: "invite" })}><UserPlus size={15} />Cadastrar pessoa</button> : undefined} />}
        </>}
        <p className="team-access-note"><LockKeyhole size={13} />Cada pessoa recebe o próprio link por e-mail e define sua senha. A administração pode editar o perfil ou desativar o acesso quando necessário.</p>
      </section></div>
      <aside className="settings-aside"><section className="panel"><PanelTitle title="Escolha o perfil de cada pessoa" /><div className="integration-list">{[{ icon: ShieldCheck, title: "Administração", text: roleHelp.admin }, { icon: UsersRound, title: "Gestão", text: roleHelp.gestao }, { icon: Database, title: "Produção", text: roleHelp.producao }, { icon: Image, title: "Qualidade", text: roleHelp.qualidade }].map(item => <div key={item.title}><span><item.icon size={18} /></span><div><strong>{item.title}</strong><p>{item.text}</p></div></div>)}</div></section><div className="settings-brand-card"><span className="eyebrow">CUIDADO TAMBÉM É GESTÃO</span><h3>Um acesso para cada pessoa.</h3><p>As confecções parceiras usam o link da área Confecções. A equipe interna entra por e-mail e senha.</p><Link className="team-partner-link" href="/confeccoes">Abrir confecções<ArrowUpRight size={15} /></Link></div></aside>
    </section>
    {selected && <Modal title="Editar acesso" subtitle="Nome e permissões da pessoa na confecção." onClose={() => { if (!saving) setSelected(null); }}><form className="form team-form" onSubmit={save}><label>Nome<input autoComplete="off" required maxLength={120} value={selected.full_name} onChange={event => setSelected({ ...selected, full_name: event.target.value })} disabled={saving} /></label><label>E-mail<input type="email" value={selected.email} readOnly disabled /><small>O e-mail identifica este acesso e não pode ser alterado aqui.</small></label><label>Perfil de acesso<select value={selected.role} onChange={event => setSelected({ ...selected, role: event.target.value as AccessRole })} disabled={saving || selected.id === profile.id}>{Object.entries(roleNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><small>{roleHelp[selected.role]}</small></label><label>Situação<select value={selected.active ? "active" : "inactive"} onChange={event => setSelected({ ...selected, active: event.target.value === "active" })} disabled={saving || selected.id === profile.id}><option value="active">Ativo</option><option value="inactive">Desativado</option></select></label>{selected.id === profile.id && <div className="team-form-note"><ShieldCheck size={17} /><p>Outra pessoa da administração deve alterar seu perfil ou desativar seu acesso.</p></div>}{editError && <div className="team-form-error" role="alert">{editError}</div>}<div className="form-footer"><button type="button" className="button secondary" onClick={() => setSelected(null)} disabled={saving}>Cancelar</button><button className="button primary" disabled={saving}>{saving ? "Salvando…" : "Salvar acesso"}<Check size={15} /></button></div></form></Modal>}
    {removingMember && <Modal title="Excluir pessoa da equipe" subtitle="Confirme qual acesso será encerrado." onClose={() => { if (!removingRef.current) { setRemovingMember(null); setRemoveError(""); } }}><form className="form team-form" onSubmit={event => { event.preventDefault(); void removeMember(); }}><div className="team-recipient"><span><Trash2 size={20} /></span><div><strong>{removingMember.full_name || "Integrante da equipe"}</strong><p>{removingMember.email}</p></div></div><div className="team-removal-warning"><TriangleAlert size={18} /><div><strong>O acesso ao painel será encerrado.</strong><p>Esta pessoa sairá da lista da equipe. Os registros que ela já fez continuarão no histórico da Moda Pink.</p></div></div>{removeError && <div className="team-form-error" role="alert"><TriangleAlert size={16} /><p>{removeError}</p></div>}<div className="form-footer"><button type="button" className="button secondary" disabled={removing} onClick={() => { setRemovingMember(null); setRemoveError(""); }}>Cancelar</button><button type="submit" className="button team-confirm-remove" disabled={removing}>{removing ? "Excluindo…" : "Excluir pessoa"}<Trash2 size={15} /></button></div></form></Modal>}
    {dialog && <Modal title={dialog.kind === "invite" ? "Cadastrar pessoa da equipe" : dialog.kind === "resend" ? "Reenviar convite" : "Enviar recuperação de senha"} subtitle={dialog.kind === "invite" ? "O convite vai por e-mail. A pessoa define a própria senha." : "Confirme para quem as instruções serão enviadas."} onClose={closeAccess}><form className="form team-form" onSubmit={submitAccess}>
      {dialog.kind === "invite" ? <fieldset disabled={sending || pending}><label>Nome da pessoa<input autoComplete="name" required maxLength={100} placeholder="Como a pessoa se chama?" value={invite.fullName} onChange={event => setInvite({ ...invite, fullName: event.target.value })} /></label><label>E-mail de acesso<input autoComplete="email" type="email" required maxLength={254} placeholder="pessoa@exemplo.com" value={invite.email} onChange={event => setInvite({ ...invite, email: event.target.value })} /><small>Confira o endereço. É nele que ela receberá o link.</small></label><label>Perfil de acesso<select value={invite.role} onChange={event => setInvite({ ...invite, role: event.target.value as AccessRole })}>{Object.entries(roleNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><small>{roleHelp[invite.role]}</small></label></fieldset> : <div className="team-recipient"><span><Mail size={20} /></span><div><strong>{dialog.member.full_name}</strong><p>{dialog.member.email}</p><small>{dialog.kind === "resend" ? "Ela receberá um novo convite para definir a própria senha." : "Ela receberá um link para escolher uma nova senha."}</small></div></div>}
      <div className="team-form-note"><ShieldCheck size={17} /><p>{pending ? "Este envio aguarda confirmação. Os dados estão preservados; reconfirmar consulta a mesma solicitação, sem iniciar outro convite." : "A senha é pessoal e será escolhida no link recebido. O cadastro público continua fechado."}</p></div>
      {accessError && <div className="team-form-error" role="alert"><TriangleAlert size={16} /><p>{accessError}</p></div>}
      {pending && accessError && !sending && <div className="team-end-attempt">{endingAttempt ? <><p>O e-mail pode já ter sido enviado. Confira a lista antes de solicitar outro envio. Encerrar limpa apenas esta tentativa no navegador.</p><div><button type="button" onClick={() => setEndingAttempt(false)}>Continuar verificando</button><button type="button" onClick={() => void endAttempt()}>Encerrar e atualizar lista</button></div></> : <button type="button" onClick={() => setEndingAttempt(true)}>Encerrar tentativa</button>}</div>}
      <div className="form-footer"><button type="button" className="button secondary" onClick={closeAccess} disabled={sending}>{pending ? "Fechar e retomar depois" : "Cancelar"}</button><button className="button primary" disabled={sending} type="submit">{sending ? "Enviando…" : pending ? "Reconfirmar envio" : dialog.kind === "recovery" ? "Enviar recuperação" : "Enviar convite"}{sending ? <RefreshCw size={15} className="team-spinning" /> : <Send size={15} />}</button></div>
    </form></Modal>}
  </>;
}
