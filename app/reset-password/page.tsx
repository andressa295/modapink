// app/reset-password/page.tsx

import ResetPasswordClient from "./ResetPasswordClient"

export default function Page({
  searchParams,
}: {
  searchParams: {
    code?: string
  }
}) {

  return (

    <ResetPasswordClient
      code={searchParams.code}
    />

  )
}