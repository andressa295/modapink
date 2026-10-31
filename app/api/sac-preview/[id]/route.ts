import { createClient } from '@/lib/supabase/server'
import { getDashboardAccess } from '@/lib/dashboard-auth'
import { getWhatsAppApiBaseUrl, getWhatsAppInternalKey } from '@/lib/whatsapp-proxy.server'
import { parseSacPreview, SAC_UUID } from '@/lib/sac-preview'
export const dynamic = 'force-dynamic'
const reply = (body: unknown, status = 200) => Response.json(body, {status, headers:{'Cache-Control':'no-store, max-age=0','X-Content-Type-Options':'nosniff'}})
export async function GET(request: Request, context: {params: Promise<{id:string}>}) {
  if (process.env.SAC_REVIEW_ENABLED !== 'true') return reply({error:'Revisão SAC desativada.'},404)
  try {
    const client = await createClient()
    const access = await getDashboardAccess(client)
    if (!access.user) return reply({error:'Sessão expirada.'},401)
    if (access.role !== 'admin') return reply({error:'Acesso restrito ao administrador.'},403)
    const {id} = await context.params
    const query = new URL(request.url).searchParams
    if (!SAC_UUID.test(id) || [...query.keys()].some(k => !['confirm_customer','lookup_order'].includes(k)) || [...query.keys()].some(k => query.getAll(k).length !== 1 || !['true','false'].includes(query.get(k)!))) return reply({error:'Consulta inválida.'},400)
    if (query.get('lookup_order') === 'true' && query.get('confirm_customer') !== 'true') return reply({error:'Confirme a classificação do contato antes da consulta.'},400)
    // Same session-scoped RLS client as authentication. Never use service role for conversation visibility.
    const {data:conversation,error} = await client.from('conversations').select('id,session_id,session_key').eq('id',id).maybeSingle()
    if (error) return reply({error:'Não foi possível conferir a conversa.'},503)
    if (!conversation || conversation.id !== id || conversation.session_id !== 'sac' || conversation.session_key !== 'sac') return reply({error:'Conversa SAC não disponível.'},404)
    const key = getWhatsAppInternalKey()
    // Unlike legacy transport, this endpoint never permits keyless loopback.
    if (!key) return reply({error:'Revisão SAC não configurada.'},503)
    const target = new URL(`${getWhatsAppApiBaseUrl()}/sac-preview/${encodeURIComponent(id)}`)
    for (const field of ['confirm_customer','lookup_order']) if (query.get(field) === 'true') target.searchParams.set(field,'true')
    const upstream = await fetch(target,{method:'GET',headers:{'x-internal-api-key':key,Accept:'application/json'},cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(15000)})
    if (!upstream.ok) return reply({error:upstream.status === 404 ? 'Prévia ausente, expirada ou desativada.' : 'Não foi possível consultar a prévia.'},upstream.status === 404 ? 404 : 502)
    if (!upstream.body || Number(upstream.headers.get('content-length')) > 32000) return reply({error:'Prévia inválida.'},502)
    const reader = upstream.body.getReader(); const decoder = new TextDecoder()
    let raw = ''; let bytes = 0
    try {
      while (true) {
        const chunk = await reader.read(); if (chunk.done) break
        bytes += chunk.value.byteLength
        if (bytes > 32000) { await reader.cancel(); return reply({error:'Prévia inválida.'},502) }
        raw += decoder.decode(chunk.value,{stream:true})
      }
      raw += decoder.decode()
    } finally { reader.releaseLock() }
    const preview = parseSacPreview(JSON.parse(raw))
    return preview ? reply(preview) : reply({error:'Prévia inválida.'},502)
  } catch { return reply({error:'Não foi possível consultar a prévia SAC.'},503) }
}
