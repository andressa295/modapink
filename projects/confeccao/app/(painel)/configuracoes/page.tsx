"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Database, LockKeyhole, Image, UsersRound, ShieldCheck, Check, RefreshCw, Pencil, LogOut, ArrowUpRight } from "lucide-react";
import { useAuth, roleNames, type AccessRole } from "../../../lib/auth-context";
import { getSupabase } from "../../../lib/supabase-client";
import { useDemo } from "../../../lib/demo-store";
import { Modal, PageHeading, PanelTitle, Empty } from "../../../components/ui";
import "../../../components/auth.css";
interface Member { id: string; full_name: string; role: AccessRole; active: boolean; }
export default function Settings() {
  const { profile, email, refresh, signOut } = useAuth();
  const { notify } = useDemo();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamError, setTeamError] = useState("");
  const [selected, setSelected] = useState<Member | null>(null);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const canManage = profile.role === "admin";
  const canList = canManage || profile.role === "gestao";
  const loadMembers = useCallback(async () => {
    if (!canList) { setLoading(false); return; }
    setLoading(true); setTeamError("");
    try {
      const { data, error } = await getSupabase().rpc("mf_list_profiles");
      if (error) throw error;
      setMembers(Array.isArray(data) ? data : []);
    } catch { setTeamError("Não foi possível carregar os acessos da equipe. Tente novamente."); }
    finally { setLoading(false); }
  }, [canList]);
  useEffect(() => { void loadMembers(); }, [loadMembers]);
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!selected || saving) return;
    const name = selected.full_name.trim();
    if (!name) { notify("Informe o nome da pessoa."); return; }
    setSaving(true);
    try {
      const { error } = await getSupabase().rpc("mf_set_profile", { p_user_id: selected.id, p_full_name: name, p_role: selected.role, p_active: selected.active });
      if (error) { notify("Não foi possível alterar esse acesso. Confira sua permissão e mantenha ao menos um administrador ativo."); return; }
      setSelected(null); await loadMembers(); await refresh(); notify("Acesso da equipe atualizado.");
    } catch { notify("Não foi possível atualizar o acesso agora. Tente novamente."); }
    finally { setSaving(false); }
  }
  async function leave() { if (signingOut) return; setSigningOut(true); try { await signOut(); } catch { notify("Não foi possível sair agora. Tente novamente."); } finally { setSigningOut(false); } }
  return <>
    <PageHeading eyebrow="PREFERÊNCIAS" title="Sua equipe. Cada acesso no lugar." description="Acompanhe sua conta e as permissões da confecção." />
    <section className="settings-grid"><div className="settings-main"><section className="panel"><PanelTitle title="Minha conta" subtitle="Acesso individual à Confecção Moda Pink" /><div className="settings-description"><span className="settings-big-icon"><ShieldCheck size={26} /></span><div><h3 className="settings-account-name">{profile.name || "Integrante da equipe"}</h3><p className="settings-account-email">{email}</p></div></div><div className="settings-facts"><div><span>Perfil de acesso</span><strong>{roleNames[profile.role]}</strong></div><div><span>Situação da conta</span><strong>Ativa</strong></div><div><span>Unidade</span><strong>Confecção Moda Pink</strong></div></div><div className="settings-account-actions"><Link className="button secondary" href="/auth/recovery"><LockKeyhole size={15} />Alterar minha senha</Link><button className="button secondary" onClick={() => void leave()} disabled={signingOut}><LogOut size={15} />{signingOut ? "Encerrando…" : "Sair da conta"}</button></div></section>
      <section className="panel"><PanelTitle title="Acessos da equipe" subtitle={canManage ? "Libere as áreas certas para cada pessoa." : "Perfis autorizados na confecção."} action={canList ? <button className="icon-button" aria-label="Atualizar lista de acessos" disabled={loading} onClick={() => void loadMembers()}><RefreshCw size={16} /></button> : undefined} />
        {!canList ? <div className="settings-inline-feedback">Seu perfil permite consultar sua própria conta. A administração acompanha e libera os demais acessos.</div> : loading ? <div className="settings-inline-feedback" role="status">Carregando os acessos da equipe…</div> : teamError ? <div className="settings-inline-feedback" role="alert">{teamError}</div> : members.length ? <div className="table-scroll"><table className="data-table team-table"><thead><tr><th>Pessoa</th><th>Perfil</th><th>Situação</th>{canManage && <th><span className="sr-only">Editar</span></th>}</tr></thead><tbody>{members.map(member => <tr key={member.id}><td><strong className="lot-code">{member.full_name || "Nome não informado"}</strong>{member.id === profile.id && <small className="table-small">Sua conta</small>}</td><td><span className="team-role">{roleNames[member.role]}</span></td><td><span className={`badge ${member.active ? "green" : "gray"}`}><i />{member.active ? "Ativo" : "Desativado"}</span></td>{canManage && <td><button className="icon-button" aria-label={`Editar acesso de ${member.full_name || "integrante"}`} onClick={() => setSelected({ ...member })}><Pencil size={15} /></button></td>}</tr>)}</tbody></table></div> : <Empty title="Nenhum acesso disponível" text="A lista será exibida após a liberação dos perfis da equipe." />}
        <p className="team-access-note">Cada pessoa usa um e-mail próprio. Novos acessos precisam de cadastro e liberação pela administração; não compartilhe contas ou senhas.</p>
      </section></div>
      <aside className="settings-aside"><section className="panel"><PanelTitle title="Como os perfis funcionam" /><div className="integration-list">{[{ icon: ShieldCheck, title: "Administração", text: "Gerencia acessos e todas as áreas da confecção." }, { icon: UsersRound, title: "Gestão", text: "Acompanha produção, materiais, qualidade e custos." }, { icon: Database, title: "Produção", text: "Organiza os modelos, materiais e o andamento dos lotes." }, { icon: Image, title: "Qualidade", text: "Registra conferências, defeitos e liberação de retrabalho." }].map(item => <div key={item.title}><span><item.icon size={18} /></span><div><strong>{item.title}</strong><p>{item.text}</p></div></div>)}</div></section><div className="settings-brand-card"><span className="eyebrow">CUIDADO TAMBÉM É GESTÃO</span><h3>Informação compartilhada. Responsabilidade individual.</h3><p>Use seu próprio acesso e mantenha sua senha em segurança.</p><span>Moda Pink × phand<ArrowUpRight size={16} /></span></div></aside>
    </section>
    {selected && <Modal title="Editar acesso" subtitle="Nome e permissões da pessoa na confecção." onClose={() => { if (!saving) setSelected(null); }}><form className="form" onSubmit={save}><label>Nome<input autoComplete="off" required maxLength={120} value={selected.full_name} onChange={e => setSelected({ ...selected, full_name: e.target.value })} disabled={saving} /></label><label>Perfil<select value={selected.role} onChange={e => setSelected({ ...selected, role: e.target.value as AccessRole })} disabled={saving || selected.id === profile.id}>{Object.entries(roleNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Situação<select value={selected.active ? "active" : "inactive"} onChange={e => setSelected({ ...selected, active: e.target.value === "active" })} disabled={saving || selected.id === profile.id}><option value="active">Ativo</option><option value="inactive">Desativado</option></select></label>{selected.id === profile.id && <div className="info-box"><p>Para preservar seu acesso, a alteração das suas permissões ou situação deve ser feita por outra pessoa da administração.</p></div>}<div className="form-footer"><button type="button" className="button secondary" onClick={() => setSelected(null)} disabled={saving}>Cancelar</button><button className="button primary" disabled={saving}>{saving ? "Salvando…" : "Salvar acesso"}<Check size={15} /></button></div></form></Modal>}
  </>;
}
