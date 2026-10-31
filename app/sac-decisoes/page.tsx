import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDashboardAccess } from '@/lib/dashboard-auth'
import SacDecisions from './SacDecisions'
export const dynamic='force-dynamic'
export default async function SacDecisionsPage(){
 if(process.env.SAC_REVIEW_DECISIONS_ENABLED!=='true')notFound()
 const access=await getDashboardAccess(await createClient())
 if(!access.user)redirect('/login')
 if(access.role!=='admin')notFound()
 return <SacDecisions/>
}
