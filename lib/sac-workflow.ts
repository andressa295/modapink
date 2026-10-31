/** Display-only representation. No state/message payload beyond the proposal. */
export type SacWorkflowCase = {conversationId:string;sessionId:'sac';version:number;outbox?:{id:string;reply:string;replyHash:string;status:'pending_review'|'approved'|'rejected'|'delivering'|'sent'|'uncertain';version:number;expiresAt:number}}
export type SacWorkflow = {mode:'review_only';sent:0;case:SacWorkflowCase|null}
const obj=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v)
export const SAC_WORKFLOW_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export const SAC_HASH=/^[a-f0-9]{64}$/
export const SAC_OUTBOX_ID=/^[a-f0-9]{64}$/
export const sacVersion=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>=1
export function parseSacWorkflow(input:unknown,conversationId:string):SacWorkflow|null{
 if(!obj(input)||input.ok!==true||input.mode!=='review_only'||input.sent!==0)return null
 if(input.case===null)return{mode:'review_only',sent:0,case:null}
 const c=input.case
 if(!obj(c)||c.conversationId!==conversationId||c.sessionId!=='sac'||!sacVersion(c.version))return null
 const result:SacWorkflowCase={conversationId,sessionId:'sac',version:c.version}
 if(c.outbox!==undefined){const o=c.outbox
  if(!obj(o)||typeof o.id!=='string'||!SAC_OUTBOX_ID.test(o.id)||typeof o.reply!=='string'||o.reply.length>6000||typeof o.replyHash!=='string'||!SAC_HASH.test(o.replyHash)||!sacVersion(o.version)||o.version!==c.version||!Number.isSafeInteger(o.expiresAt)||Number(o.expiresAt)<=0||typeof o.status!=='string'||!['pending_review','approved','rejected','delivering','sent','uncertain'].includes(o.status))return null
  result.outbox={id:o.id,reply:o.reply,replyHash:o.replyHash,status:o.status as NonNullable<SacWorkflowCase['outbox']>['status'],version:o.version,expiresAt:o.expiresAt as number}
 }
 return{mode:'review_only',sent:0,case:result}
}
