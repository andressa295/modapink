import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

const SUPABASE_REQUEST_TIMEOUT_MS = 8_000
const SUPABASE_REQUEST_ATTEMPTS = 2

const stableSupabaseFetch: typeof fetch = async (input, init) => {
  let lastError: unknown

  for (let attempt = 1; attempt <= SUPABASE_REQUEST_ATTEMPTS; attempt += 1) {
    const controller = new AbortController()
    const upstreamSignal = init?.signal
    const abortFromUpstream = () => controller.abort(upstreamSignal?.reason)
    const timeout = setTimeout(
      () => controller.abort(new Error("SUPABASE_REQUEST_TIMEOUT")),
      SUPABASE_REQUEST_TIMEOUT_MS
    )

    upstreamSignal?.addEventListener("abort", abortFromUpstream, { once: true })

    try {
      return await fetch(input, {
        ...init,
        signal: controller.signal,
      })
    } catch (error) {
      lastError = error

      if (upstreamSignal?.aborted || attempt === SUPABASE_REQUEST_ATTEMPTS) {
        throw error
      }
    } finally {
      clearTimeout(timeout)
      upstreamSignal?.removeEventListener("abort", abortFromUpstream)
    }
  }

  throw lastError
}

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: stableSupabaseFetch,
      },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {}
        },
      },
    }
  )
}
