import { createHash } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { getDashboardAccess } from '@/lib/dashboard-auth'
import { getWhatsAppApiBaseUrl, getWhatsAppInternalKey, readLimitedWhatsAppBody } from '@/lib/whatsapp-proxy.server'
import { parseSacWorkflow, SAC_HASH, SAC_OUTBOX_ID, SAC_WORKFLOW_UUID, sacVersion } from '@/lib/sac-workflow'
export const dynamic='force-dynamic'
const response=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store, max-age=0','X-Content-Type-Options':'nosniff'}})
const object=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v)
function validOrigin(req:Request){
 const configured=process.env.SAC_REVIEW_ORIGIN || process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL
 if(!configured||!req.headers.get('origin'))return false
 try {const expected=new URL(configured);const origin=new URL(req.headers.get('origin')!);return ['http:','https:'].includes(expected.protocol)&&!expected.username&&!expected.password&&!expected.search&&!expected.hash&&expected.pathname==='/'&&origin.origin===expected.origin&&origin.toString()===expected.origin+'/'&&(!req.headers.has('sec-fetch-site')||req.headers.get('sec-fetch-site')==='same-origin')}catch{return false}
}
async function handle(req:Request,ctx:{params:Promise<{id:string}>},mutation:boolean){
 if(process.env.SAC_REVIEW_DECISIONS_ENABLED!=='true')return response({error:'Decisões SAC desativadas.'},404)
 try{
  const client=await createClient();const access=await getDashboardAccess(client)
  if(!access.user)return response({error:'Sessão expirada.'},401)
  if(access.role!=='admin'||!SAC_WORKFLOW_UUID.test(access.user.id))return response({error:'Acesso restrito ao administrador.'},403)
  const {id}=await ctx.params
  if(!SAC_WORKFLOW_UUID.test(id)||new URL(req.url).search)return response({error:'Consulta inválida.'},400)
  if(mutation&&!validOrigin(req))return response({error:'Origem não permitida ou não configurada.'},403)
  const {data,error}=await client.from('conversations').select('id,session_id,session_key').eq('id',id).maybeSingle()
  if(error)return response({error:'Falha ao conferir a conversa.'},503)
  if(!data||data.id!==id||data.session_id!=='sac'||data.session_key!=='sac')return response({error:'Conversa SAC não disponível.'},404)
  const key=getWhatsAppInternalKey();if(!key)return response({error:'Revisão SAC não configurada.'},503)
  let body:string|undefined
  let expected:{version:number;id:string;hash:string;status:'approved'|'rejected'}|undefined
  if(mutation){
   if(req.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')return response({error:'Envie JSON.'},415)
   const raw=await readLimitedWhatsAppBody(req,2048);if(typeof raw!=='string')return raw
   let p:unknown;try{p=JSON.parse(raw)}catch{return response({error:'Decisão inválida.'},400)}
   const fields=['expectedVersion','outboxId','replyHash','decision']
   if(!object(p)||Object.keys(p).length!==fields.length||Object.keys(p).some(k=>!fields.includes(k))||!sacVersion(p.expectedVersion)||typeof p.outboxId!=='string'||!SAC_OUTBOX_ID.test(p.outboxId)||typeof p.replyHash!=='string'||!SAC_HASH.test(p.replyHash)||typeof p.decision!=='string'||!['approve','reject'].includes(p.decision))return response({error:'Decisão inválida.'},400)
   expected={version:p.expectedVersion,id:p.outboxId,hash:p.replyHash,status:p.decision==='approve'?'approved':'rejected'}
   body=JSON.stringify({...p,sessionId:'sac',operatorId:access.user.id})
  }
  const target=new URL(`${getWhatsAppApiBaseUrl()}/sac-workflow/${encodeURIComponent(id)}${mutation?'/review':''}`)
  const upstream=await fetch(target,{method:mutation?'POST':'GET',body,headers:{'x-internal-api-key':key,'Content-Type':'application/json',Accept:'application/json'},cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(15000)})
  if(!upstream.ok){const status=[404,409].includes(upstream.status)?upstream.status:502;return response({error:status===409?'A proposta mudou. Consulte novamente antes de decidir.':status===404?'Caso não disponível.':'Resultado não confirmado. Consulte o caso antes de qualquer nova decisão.',uncertain:mutation&&status!==404&&status!==409},status)}
  if(!upstream.body||Number(upstream.headers.get('content-length'))>32000)return response({error:'Resposta inválida. Consulte o caso antes de continuar.',uncertain:mutation},502)
  const reader=upstream.body.getReader();const decoder=new TextDecoder();let raw='';let bytes=0
  try{while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>32000){await reader.cancel();return response({error:'Resposta inválida. Consulte o caso antes de continuar.',uncertain:mutation},502)}raw+=decoder.decode(part.value,{stream:true})}raw+=decoder.decode()}finally{reader.releaseLock()}
  const payload:unknown=JSON.parse(raw);const parsed=parseSacWorkflow(payload,id)
  if(!parsed||parsed.case?.outbox&&createHash('sha256').update(parsed.case.outbox.reply).digest('hex')!==parsed.case.outbox.replyHash)return response({error:'Resposta inválida. Consulte o caso antes de continuar.',uncertain:mutation},502)
  if(mutation&&(!expected||!object(payload)||payload.status!==expected.status||parsed.case?.outbox?.status!==expected.status||parsed.case?.outbox?.id!==expected.id||parsed.case?.outbox?.replyHash!==expected.hash||parsed.case?.version!==expected.version+1))return response({error:'Decisão não confirmada. Consulte o caso.',uncertain:true},502)
  return response(parsed)
 }catch{return response({error:mutation?'Resultado não confirmado. Consulte o caso antes de qualquer nova decisão.':'Não foi possível consultar o caso.',uncertain:mutation},503)}
}
export const GET=(r:Request,c:{params:Promise<{id:string}>})=>handle(r,c,false)
export const POST=(r:Request,c:{params:Promise<{id:string}>})=>handle(r,c,true)
