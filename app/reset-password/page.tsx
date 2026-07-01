import ResetPasswordClient from "./ResetPasswordClient"

export const dynamic = "force-dynamic"

type PageProps = {
  searchParams?: Promise<{
    code?: string
    type?: string
    error?: string
    error_description?: string
  }>
}

export default async function ResetPasswordPage({
  searchParams
}: PageProps) {
  const params = await searchParams

  return (
    <ResetPasswordClient
      code={params?.code}
      errorParam={params?.error}
      errorDescription={params?.error_description}
    />
  )
}