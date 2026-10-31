'use client'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { SacPreview } from '@/lib/sac-preview'
import { SAC_UUID } from '@/lib/sac-preview'
import styles from './sac-review.module.css'
const intents: Record<string,string> = {exchange:'Troca',address_change:'Endereço',add_items:'Adicionar peças',tracking:'Entrega e rastreio',shipping_change:'Envio e endereço',missing_item:'Peça faltante',wrong_item:'Peça errada',defect:'Defeito ou qualidade',substitution:'Troca ou inclusão',payment:'Pagamento',cancellation:'Cancelamento',human:'Atendimento humano',unknown:'Aguardando escolha no menu'}
export default function SacReview() {
  const [id,setId] = useState(''); const [confirmed,setConfirmed] = useState(false); const [lookup,setLookup] = useState(false)
  const [preview,setPreview] = useState<SacPreview|null>(null); const [error,setError] = useState(''); const [busy,setBusy] = useState(false)
  const controller = useRef<AbortController|null>(null); const revision = useRef(0)
  useEffect(() => () => {revision.current++;controller.current?.abort()},[])
  function invalidate() { revision.current++;controller.current?.abort();setPreview(null);setError('');setBusy(false) }
  async function consult(event: FormEvent) {
    event.preventDefault(); if (busy) return
    invalidate(); if (!SAC_UUID.test(id.trim())) {setError('Informe o identificador válido da conversa SAC.');return}
    const current = revision.current; const abort = new AbortController(); controller.current=abort;setBusy(true)
    const query = new URLSearchParams({confirm_customer:String(confirmed),lookup_order:String(lookup && confirmed)})
    try {
      const response = await fetch(`/api/sac-preview/${encodeURIComponent(id.trim())}?${query}`,{cache:'no-store',signal:abort.signal})
      const result = await response.json()
      if (current !== revision.current) return
      if (!response.ok) {setError(result.error || 'Não foi possível consultar.');return}
      setPreview(result)
    } catch {if (current === revision.current && !abort.signal.aborted) setError('Falha na consulta. Tente novamente quando a conexão estiver disponível.')}
    finally {if (current === revision.current) setBusy(false)}
  }
  return <main className={styles.page}>
    <a href="/dashboard/conversas" className={styles.back}>Voltar às conversas</a>
    <header><span className={styles.eyebrow}>EXCLUSIVO DO SAC · SOMENTE LEITURA</span><h1>Revisão do atendimento</h1><p>Confira a proposta do bot antes de qualquer futura ativação. Esta tela não envia mensagens, não aprova ações e não altera pedidos. O atendimento e as mensagens do menu atual continuam independentes desta revisão.</p></header>
    <section className={styles.notice}>O menu normal continua sendo a entrada do SAC. A proposta dá sequência ao assunto escolhido. Prévia temporária: até 15 minutos, sem histórico permanente nesta tela.</section>
    <form onSubmit={consult} className={styles.card}>
      <label htmlFor="conversation">Identificador da conversa SAC</label>
      <input id="conversation" value={id} onChange={e=>{invalidate();setId(e.target.value);setConfirmed(false);setLookup(false)}} placeholder="UUID da conversa" autoComplete="off" spellCheck={false}/>
      <label className={styles.check}><input type="checkbox" checked={confirmed} onChange={e=>{invalidate();setConfirmed(e.target.checked);setLookup(false)}}/>Conferi que é uma cliente, não um contato operacional.</label>
      <label className={styles.check}><input type="checkbox" checked={lookup} disabled={!confirmed} onChange={e=>{invalidate();setLookup(e.target.checked)}}/>Consultar pedido na fonte, quando disponível e com vínculo confirmado.</label>
      <p className={styles.small}>Marcar “cliente” não comprova a titularidade do pedido. A verificação é feita separadamente pela API.</p>
      <button disabled={busy} type="submit">{busy ? 'Consultando…' : 'Consultar proposta'}</button>
    </form>
    <div aria-live="polite">{error && <p role="alert" className={styles.error}>{error}</p>}{preview && <section className={styles.card}>
      <span className={styles.eyebrow}>PROPOSTA · NÃO ENVIADA</span><h2>{intents[preview.plan.intent] || preview.plan.intent}</h2>
      <p><strong>Etapa:</strong> {preview.plan.nextState?.awaitingMenu ? 'Aguardando escolha no menu' : preview.plan.nextState?.stage || preview.plan.disposition}</p>
      {preview.plan.proposedReply ? <div className={styles.proposal}>{preview.plan.proposedReply}</div> : <p>Nenhuma resposta sugerida neste estado.</p>}
      {preview.plan.approval && <div className={styles.notice}><strong>Decisão pendente da equipe</strong><p>{preview.plan.approval.summary}</p></div>}
      <details><summary>Motivo técnico</summary><p>{preview.plan.reason}</p></details>
      <p className={styles.small}>Nenhuma ação foi executada. Para tratar o caso real, use o atendimento autorizado da equipe.</p>
    </section>}</div>
  </main>
}
