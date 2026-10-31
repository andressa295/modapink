/** Narrow, display-only contract. Unknown upstream fields never reach the browser. */
export type SacPreview = {
  mode: 'preview'; sent: 0; persisted: 0;
  customer_classification_confirmed: boolean;
  plan: { disposition: string; reason: string; intent: string; proposedReply?: string;
    nextState?: { intent: string; stage: string; awaitingMenu?: boolean };
    approval?: { kind: string; summary: string }; canSend: false }
}
const INTENTS = ['tracking','shipping_change','missing_item','wrong_item','defect','substitution','payment','cancellation','human','unknown','exchange','address_change','add_items']
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max
export function parseSacPreview(value: unknown): SacPreview | null {
  if (!record(value) || value.ok !== true || value.mode !== 'preview' || value.sent !== 0 || value.persisted !== 0 || typeof value.customer_classification_confirmed !== 'boolean' || !record(value.plan)) return null
  const p = value.plan
  if (p.canSend !== false || !Array.isArray(p.effects) || p.effects.length !== 0 || !text(p.disposition, 80) || !['ignored','duplicate','review','proposed_reply','human_required'].includes(p.disposition) || !text(p.reason, 200) || !text(p.intent, 80) || !INTENTS.includes(p.intent)) return null
  const plan: SacPreview['plan'] = { disposition:p.disposition, reason:p.reason, intent:p.intent, canSend:false }
  if (p.proposedReply !== undefined) { if (!text(p.proposedReply, 6000)) return null; plan.proposedReply=p.proposedReply }
  if (p.nextState !== undefined) {
    if (!record(p.nextState) || p.nextState.sessionId !== 'sac' || !text(p.nextState.intent,80) || !INTENTS.includes(p.nextState.intent) || !text(p.nextState.stage,80) || !['collecting','awaiting_team','awaiting_customer','resolved'].includes(p.nextState.stage)) return null
    plan.nextState = {intent:p.nextState.intent,stage:p.nextState.stage,awaitingMenu:p.nextState.awaitingMenu === true}
  }
  if (p.approval !== undefined) {
    if (!record(p.approval) || !text(p.approval.kind,80) || !text(p.approval.summary,2000)) return null
    plan.approval = {kind:p.approval.kind,summary:p.approval.summary}
  }
  return { mode:'preview', sent:0, persisted:0, customer_classification_confirmed:value.customer_classification_confirmed, plan }
}
export const SAC_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
