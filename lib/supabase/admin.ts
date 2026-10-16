import 'server-only'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { env } from '@/lib/config'
import { type Database } from '@/types/database'

/*
 * Client on the trading company's (server) side. Does not go through RLS.
 * It can only be used in the following two places:
 *   - lib/shosha/answer.ts ... transition to ANSWERED and writing answer_*, answer_logs, and reading necessary
 *                              for the determination (because it uses the same counting method as the genba server)
 *   - lib/shosha/audit.ts  ... appending to audit logs
 *
 * Do not use it for reading to display on the screen or writing anything other than answers.
 * Receptionist session (lib/supabase/server.ts) uses RLS. 
 * Expanding on this, tenant isolation will be protected by if statements on the screen.
 */
export function createAdminClient() {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY が設定されていません。回答の送信はサーバ側でのみ行えます。',
    )
  }

  return createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}
