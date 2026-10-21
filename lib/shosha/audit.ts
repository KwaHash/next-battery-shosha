import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

export type AuditInput = {
  tenantId: string;
  actor: string;
  action: string;
  entity?: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}

export async function recordAudit(input: AuditInput): Promise<void> {
  await write({ ...input, denied: false, reasons: null })
}

/** 止めた操作を残す。何を理由に止めたかまで書く。 */
export async function recordDenied(
  input: AuditInput & { reasons: string[] },
): Promise<void> {
  await write({
    ...input,
    action: `DENIED:${input.action}`,
    denied: true,
    reasons: input.reasons,
  })
}

async function write(row: {
  tenantId: string;
  actor: string;
  action: string;
  entity?: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  denied: boolean;
  reasons: string[] | null;
}) {
  try {
    const supabase = createAdminClient()
    await supabase.from('audit_events').insert({
      tenant_id: row.tenantId,
      actor: row.actor,
      action: row.action,
      entity: row.entity ?? null,
      entity_id: row.entityId ?? null,
      before: (row.before ?? null) as never,
      after: (row.after ?? null) as never,
      denied: row.denied,
      reasons: row.reasons,
    })
  } catch (error) {
    // 監査の失敗で業務を止めない。ただし黙って捨てもしない。
    console.error('監査ログの記録に失敗しました', { action: row.action, error })
  }
}
