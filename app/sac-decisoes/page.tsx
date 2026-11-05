import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDashboardAccess } from '@/lib/dashboard-auth'
import { canAccessMessaging } from '@/lib/dashboard-access'
import { SAC_WORKFLOW_UUID } from '@/lib/sac-workflow'
import SacDecisions from './SacDecisions'
export const dynamic='force-dynamic'
export default async function SacDecisionsPage({searchParams}: {searchParams: Promise<{conversation?:string|string[]}>}){
 if(process.env.SAC_REVIEW_DECISIONS_ENABLED!=='true')notFound()
 const access=await getDashboardAccess(await createClient())
 if(!access.user)redirect('/login')
 if(!canAccessMessaging(access.role))notFound()
 const requested=(await searchParams).conversation
 const initialConversationId=typeof requested==='string'&&SAC_WORKFLOW_UUID.test(requested)?requested:''
 return <SacDecisions key={initialConversationId} initialConversationId={initialConversationId}/>
}
