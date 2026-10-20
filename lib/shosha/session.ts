import 'server-only'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { type StaffRole } from '@/types/database'

export type StaffTenant = {
  tenantId: string;
  name: string;
  role: StaffRole;
  /** memberships にも行があるか。無いと requests を RLS 越しに読めない */
  readable: boolean;
}

export type StaffSession = {
  userId: string;
  email: string | null;
  /** 回答の署名に出す名前（例：電池屋 担当A） */
  actor: string;
  tenants: StaffTenant[];
  tenantIds: string[];
}

/**
 * 受付担当としてのセッション。
 * shosha_staff に行が無い人は、サインインできていても入れない。
 */
export async function getStaffSession(): Promise<StaffSession | null> {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: staff }, { data: memberships }] = await Promise.all([
    supabase
      .from('shosha_staff')
      .select('tenant_id, display_name, role')
      .eq('user_id', user.id)
      .is('archived_at', null),
    supabase.from('memberships').select('tenant_id').eq('user_id', user.id),
  ])

  if (!staff?.length) return null

  const tenantIds = staff.map((s) => s.tenant_id)
  const { data: tenants } = await supabase.from('tenants').select('id, name').in('id', tenantIds)
  const names = new Map((tenants ?? []).map((t) => [t.id, t.name]))
  const readable = new Set((memberships ?? []).map((m) => m.tenant_id))

  return {
    userId: user.id,
    email: user.email ?? null,
    actor: staff[0].display_name,
    tenants: staff.map((s) => ({
      tenantId: s.tenant_id,
      name: names.get(s.tenant_id) ?? '（名称未設定）',
      role: s.role,
      readable: readable.has(s.tenant_id),
    })),
    tenantIds,
  }
}

export async function requireStaff(): Promise<StaffSession> {
  const session = await getStaffSession()
  if (!session) redirect('/login')
  return session
}

export function tenantName(session: StaffSession, tenantId: string): string {
  return session.tenants.find((t) => t.tenantId === tenantId)?.name ?? '—'
}
