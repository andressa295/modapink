'use client'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { SAC_WORKFLOW_UUID } from '@/lib/sac-workflow'
import type { SacWorkflow } from '@/lib/sac-workflow'
import styles from '../sac-revisao/sac-review.module.css'
const labels:Record<string,string>={pending_review:'Aguardando decisão',approved:'Resposta aprovada, ainda não enviada',rejected:'Proposta rejeitada',delivering:'Envio em processamento — não repita',sent:'Envio registrado pela API',uncertain:'Resultado de envio incerto — conferência necessária'}
export default function SacDecisions(){
 const [id,setId]=useState('');const [view,setView]=useState<SacWorkflow|null>(null);const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [deciding,setDeciding]=useState(false);const [checked,setChecked]=useState(false);const [uncertain,setUncertain]=useState(false)
 const controller=useRef<AbortController|null>(null);const revision=useRef(0);const mutationLock=useRef(false)
 useEffect(()=>()=>{revision.current++;controller.current?.abort()},[])
 const clear=()=>{revision.current++;controller.current?.abort();setView(null);setChecked(false);setError('');setBusy(false)}
 async function consult(event:FormEvent){event.preventDefault();if(mutationLock.current||busy)return;clear();if(!SAC_WORKFLOW_UUID.test(id.trim())){setError('Informe o identificador válido da conversa SAC.');return}const version=revision.current;const c=new AbortController();controller.current=c;setBusy(true)
 try{const r=await fetch(`/api/sac-workflow/${encodeURIComponent(id.trim())}`,{cache:'no-store',signal:c.signal});const data=await r.json();if(version!==revision.current)return;if(!r.ok){setError(data.error||'Consulta indisponível.');return}setView(data);setUncertain(false)}catch{if(version===revision.current&&!c.signal.aborted)setError('Não foi possível consultar. Nenhuma decisão foi enviada.')}finally{if(version===revision.current)setBusy(false)}}
 async function decide(decision:'approve'|'reject'){
  const state=view?.case;const outbox=state?.outbox
  if(mutationLock.current||!checked||uncertain||!state||!outbox||outbox.status!=='pending_review')return
  if(Date.now()>=outbox.expiresAt){setView(null);setChecked(false);setError('Proposta expirada. Consulte novamente antes de decidir.');return}
  mutationLock.current=true;setDeciding(true);setError('');setChecked(false)
  const version=revision.current
  try{
   const r=await fetch(`/api/sac-workflow/${encodeURIComponent(state.conversationId)}`,{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({expectedVersion:state.version,outboxId:outbox.id,replyHash:outbox.replyHash,decision})})
   const data=await r.json();if(version!==revision.current)return
   if(!r.ok){setView(null);setUncertain(true);setError(data.error||'Resultado não confirmado. Consulte o caso antes de continuar.');return}
   setView(data)
  }catch{if(version===revision.current){setView(null);setUncertain(true);setError('Resultado não confirmado. Não repita a decisão: consulte o caso para conferir.')}}finally{mutationLock.current=false;if(version===revision.current)setDeciding(false)}
 }
 const outbox=view?.case?.outbox
 return <main className={styles.page}>
  <a className={styles.back} href="/sac-revisao">Voltar à revisão de propostas</a>
  <header><span className={styles.eyebrow}>EXCLUSIVO DO SAC · DECISÃO SOBRE RESPOSTA</span><h1>Conferir resposta do SAC</h1><p>Aprove ou rejeite somente o texto apresentado. Esta decisão não envia mensagem, não autoriza reembolso, não troca peças e não altera pedido. O envio depende de uma etapa separada.</p></header>
  <section className={styles.notice}>O menu normal permanece como entrada. A decisão vale apenas para esta versão da resposta; se o caso mudar, será necessário conferir a nova proposta.</section>
  <form className={styles.card} onSubmit={consult}><label htmlFor="decision-conversation">Identificador da conversa SAC</label><input id="decision-conversation" value={id} disabled={deciding} autoComplete="off" spellCheck={false} onChange={e=>{clear();setId(e.target.value)}}/><p className={styles.small}>Somente conversas SAC visíveis ao administrador autenticado.</p><button disabled={busy||deciding}>{busy?'Consultando…':'Consultar caso'}</button></form>
  <div aria-live="polite">{error&&<p role="alert" className={styles.error}>{error}</p>}{uncertain&&<p className={styles.notice}>Não repita a decisão sem consultar o estado atualizado.</p>}{view&&!view.case&&<p>Nenhum caso disponível.</p>}{view?.case&&<section className={styles.card}>
   <span className={styles.eyebrow}>VERSÃO {view.case.version}</span><h2>{outbox?labels[outbox.status]:'Sem resposta para decidir'}</h2>
   {outbox&&<><div className={styles.proposal}>{outbox.reply}</div><p className={styles.small}>Validade: {new Date(outbox.expiresAt).toLocaleString('pt-BR')}. A aprovação se aplica exatamente ao texto acima. Não há edição ou envio nesta tela.</p></>}
   {outbox?.status==='pending_review'&&!uncertain&&<><label className={styles.check}><input type="checkbox" checked={checked} disabled={deciding} onChange={e=>setChecked(e.target.checked)}/>Conferi o texto e entendo que a decisão é somente sobre esta resposta, sem executar ações no pedido.</label><div style={{display:'flex',gap:12,flexWrap:'wrap'}}><button type="button" disabled={!checked||deciding} onClick={()=>decide('approve')}>{deciding?'Registrando decisão…':'Aprovar somente esta resposta'}</button><button type="button" disabled={!checked||deciding} onClick={()=>decide('reject')}>Rejeitar proposta</button></div></>}
  </section>}</div>
 </main>
}
