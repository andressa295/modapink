import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDashboardAccess } from '@/lib/dashboard-auth'
import SacReview from './SacReview'
export const dynamic = 'force-dynamic'
export default async function SacReviewPage() {
  if (process.env.SAC_REVIEW_ENABLED !== 'true') notFound()
  const access = await getDashboardAccess(await createClient())
  if (!access.user) redirect('/login')
  if (access.role !== 'admin') notFound()
  return <SacReview />
}
