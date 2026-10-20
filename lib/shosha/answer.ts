import 'server-only'

import { canAutoAnswer, draftAnswer } from '@/lib/domain/auto-answer'
import { recordAudit, recordDenied } from '@/lib/shosha/audit'
import { createAdminClient } from '@/lib/supabase/admin'
import { type RequestRow } from '@/types/database'

/**
 * 回答の書き込み。**ANSWERED への遷移と answer_* はここからしか書かない。**
 *
 * 現場側は SENT までしか進められない（genba H-1）。DB のトリガー（guard_request_answer）も
 * 同じ制約を持つため、回答は service role で書く。呼ぶ側は、受付担当であることと、
 * その依頼が担当のテナントのものであることを先に確かめておくこと（lib/shosha/actions.ts）。
 */

const AUTO_SIGNATURE = '電池屋 自動回答'

const APPROVED_STATUSES: RequestRow['status'][] = ['ANSWERED', 'ORDERED']

export type HumanAnswer = {
  requestId: string;
  tenantId: string;
  model: string;
  channel: RequestRow['channel'];
  actor: string;
  text: string;
  /** 判定の記録。人が返した理由（止まった条件）か、満たしていた条件 */
  reasons: string[];
  alternatives: string[];
  deliveryPromised: string;
  edited: boolean;
  minutes: number | null;
}

export type WriteResult = { ok: true } | { ok: false; reasons: string[] }

export async function writeHumanAnswer(answer: HumanAnswer): Promise<WriteResult> {
  const admin = createAdminClient()

  // SENT のときだけ書く。自動回答や別の担当者と同時に返しても、二重にならない。
  const { data: updated, error } = await admin
    .from('requests')
    .update({
      status: 'ANSWERED',
      answer_by: answer.actor,
      answer_at: new Date().toISOString(),
      answer_text: answer.text,
      // HUMAN で書いた回答が、次の同じ型番の「人が承認した履歴」になる。
      answer_mode: 'HUMAN',
      answer_reasons: answer.reasons,
      alternatives: answer.alternatives.length ? answer.alternatives : null,
      delivery_promised: answer.deliveryPromised,
    })
    .eq('id', answer.requestId)
    .eq('tenant_id', answer.tenantId)
    .eq('status', 'SENT')
    .select('id')

  if (error) return { ok: false, reasons: [error.message] }
  if (!updated?.length) {
    return { ok: false, reasons: ['すでに返信されています。画面を開き直してください'] }
  }

  await writeLog(admin, {
    tenant_id: answer.tenantId,
    request_id: answer.requestId,
    model: answer.model,
    channel: answer.channel,
    mode: 'HUMAN',
    approved_by_human: true,
    edited: answer.edited,
    minutes: answer.minutes,
    answered_by: answer.actor,
  })

  await recordAudit({
    tenantId: answer.tenantId,
    actor: answer.actor,
    action: 'ANSWER',
    entity: 'requests',
    entityId: answer.requestId,
    before: { status: 'SENT' },
    after: {
      status: 'ANSWERED',
      mode: 'HUMAN',
      edited: answer.edited,
      minutes: answer.minutes,
      delivery_promised: answer.deliveryPromised,
      alternatives: answer.alternatives,
    },
  })

  return { ok: true }
}

export type AutoResult =
  | { answered: true }
  | { answered: false; reasons: string[] }

/**
 * 5条件を通ったものだけ自動で返す。genba の answerRequestOnServer と同じ判定・同じ書き方。
 * 止めたときは理由を残す（DENIED:AUTO_ANSWER）。
 */
export async function tryAutoAnswer(requestId: string, triggeredBy: string): Promise<AutoResult> {
  const admin = createAdminClient()

  const { data: request } = await admin
    .from('requests')
    .select('*, items:request_items(*)')
    .eq('id', requestId)
    .maybeSingle()

  const item = request?.items?.sort((a, b) => a.position - b.position)[0]
  if (!request || !item) return { answered: false, reasons: ['依頼が見つかりません'] }
  if (request.status !== 'SENT') return { answered: false, reasons: ['すでに返信されています'] }

  const [{ count }, { data: aliases }] = await Promise.all([
    admin
      .from('request_items')
      .select('id, requests!inner(status, answer_mode)', { count: 'exact', head: true })
      .eq('tenant_id', request.tenant_id)
      .eq('model', item.model)
      .neq('request_id', requestId)
      .eq('requests.answer_mode', 'HUMAN')
      .in('requests.status', APPROVED_STATUSES),
    admin
      .from('model_aliases')
      .select('from_model, to_model')
      .eq('tenant_id', request.tenant_id)
      .eq('to_model', item.model)
      .is('archived_at', null),
  ])

  const ctx = { answeredBefore: (count ?? 0) > 0, aliases: aliases ?? [] }
  const verdict = canAutoAnswer(item, ctx)

  if (!verdict.ok) {
    await recordDenied({
      tenantId: request.tenant_id,
      actor: 'system',
      action: 'AUTO_ANSWER',
      entity: 'requests',
      entityId: requestId,
      reasons: verdict.blockers,
      after: { triggered_by: triggeredBy },
    })
    await admin.from('requests').update({ answer_reasons: verdict.blockers }).eq('id', requestId)
    return { answered: false, reasons: verdict.blockers }
  }

  const { data: updated, error } = await admin
    .from('requests')
    .update({
      status: 'ANSWERED',
      answer_by: AUTO_SIGNATURE,
      answer_at: new Date().toISOString(),
      answer_text: draftAnswer(item, ctx),
      answer_mode: 'AUTO',
      answer_reasons: verdict.reasons,
    })
    .eq('id', requestId)
    .eq('status', 'SENT')
    .select('id')

  if (error) return { answered: false, reasons: [error.message] }
  if (!updated?.length) return { answered: false, reasons: ['すでに返信されています'] }

  await writeLog(admin, {
    tenant_id: request.tenant_id,
    request_id: requestId,
    model: item.model,
    channel: request.channel,
    mode: 'AUTO',
    approved_by_human: false,
    edited: false,
    minutes: 0,
    answered_by: AUTO_SIGNATURE,
  })

  await recordAudit({
    tenantId: request.tenant_id,
    actor: 'system',
    action: 'AUTO_ANSWER',
    entity: 'requests',
    entityId: requestId,
    after: { mode: 'AUTO', reasons: verdict.reasons, triggered_by: triggeredBy },
  })

  return { answered: true }
}

async function writeLog(
  admin: ReturnType<typeof createAdminClient>,
  row: {
    tenant_id: string;
    request_id: string;
    model: string;
    channel: RequestRow['channel'];
    mode: 'AUTO' | 'HUMAN';
    approved_by_human: boolean;
    edited: boolean;
    minutes: number | null;
    answered_by: string;
  },
) {
  // 回答そのものは済んでいる。履歴の失敗で回答を巻き戻さない。ただし黙って捨てもしない。
  const { error } = await admin
    .from('answer_logs')
    .upsert(row, { onConflict: 'request_id', ignoreDuplicates: true })
  if (error) {
    console.error('回答の履歴を記録できませんでした', { requestId: row.request_id, error })
  }
}
