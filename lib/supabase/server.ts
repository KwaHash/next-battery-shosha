import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { env } from '@/lib/config'
import { type Database } from '@/types/database'

/**
 * Server-side (RSC/Server Action) Supabase client.
 * Runs with the privileges of the logged-in user. RLS ensures tenant isolation.
 */
export function createClient() {
  const cookieStore = cookies()

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Cookies cannot be written from RSC. Session updates are handled by middleware.
          }
        },
      },
    },
  )
}
