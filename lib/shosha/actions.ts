'use server'

import { revalidatePath } from 'next/cache'
import { canAutoAnswer, draftAnswer } from '@/lib/domain/auto-answer'
import { today } from '@/lib/domain/clock'
import { deliveryPlan, isEdited, withArrivalLine } from '@/lib/domain/delivery'
import { handlingMinutes } from '@/lib/domain/metrics'
import { tryAutoAnswer, writeHumanAnswer } from '@/lib/shosha/answer'
import { recordAudit, recordDenied } from '@/lib/shosha/audit'
import { countHumanApprovals, getInquiry, listAliases } from '@/lib/shosha/queries'
import { type StaffSession, requireStaff } from '@/lib/shosha/session'
import { createClient } from '@/lib/supabase/server'
import {
  aliasSchema,
  answerSchema,
  deliveryChangeSchema,
  intakeSchema,
} from '@/lib/validations/shosha'
import { type ActionResult } from '@/types/shosha'

function fail(reasons: string[]): ActionResult<never> {
  return { ok: false, reasons }
}

function issues(error: { issues: { message: string }[] }): ActionResult<never> {
  return fail(error.issues.map((i) => i.message))
}

function ownsTenant(session: StaffSession, tenantId: string): boolean {
  return session.tenantIds.includes(tenantId)
}

function revalidateInquiry(requestId?: string) {
  revalidatePath('/inbox')
  revalidatePath('/effect')
  if (requestId) revalidatePath(`/inbox/${requestId}`)
}

/** 最初に開いた時刻を残す。対応時間の起点。2回目以降は書かない。 */
export async function markOpened(requestId: string): Promise<ActionResult> {
  const session = await requireStaff()
  const inquiry = await getInquiry(session, requestId)
  if (!inquiry) return fail(['依頼が見つかりません'])
  if (inquiry.status !== 'SENT') return { ok: true, data: undefined }

  const supabase = createClient()
  const { error } = await supabase.from('request_opens').upsert(
    { request_id: requestId, tenant_id: inquiry.tenant_id, opened_by: session.actor },
    { onConflict: 'request_id', ignoreDuplicates: true },
  )
  if (error) return fail([error.message])
  return { ok: true, data: undefined }
}

/** 担当者が直して返信する。 */
export async function sendAnswer(input: unknown): Promise<ActionResult> {
  const session = await requireStaff()
  const parsed = answerSchema.safeParse(input)
  if (!parsed.success) return issues(parsed.error)

  const { requestId, text, route, workDate, alternatives } = parsed.data
  const inquiry = await getInquiry(session, requestId)
  const item = inquiry?.items[0]
  if (!inquiry || !item) return fail(['依頼が見つかりません'])

  if (inquiry.status !== 'SENT') {
    const reasons = ['すでに返信されています。画面を開き直してください']
    await recordDenied({
      tenantId: inquiry.tenant_id,
      actor: session.actor,
      action: 'ANSWER',
      entity: 'requests',
      entityId: requestId,
      reasons,
      after: { status: inquiry.status },
    })
    return fail(reasons)
  }

  const supabase = createClient()
  const [aliases, humanApprovals, site, opened] = await Promise.all([
    listAliases([inquiry.tenant_id]),
    countHumanApprovals(inquiry.tenant_id, item.model, requestId),
    inquiry.site_id
      ? supabase.from('sites').select('receive_note').eq('id', inquiry.site_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('request_opens').select('opened_at').eq('request_id', requestId).maybeSingle(),
  ])

  const ctx = { answeredBefore: humanApprovals > 0, aliases }
  const verdict = canAutoAnswer(item, ctx)
  const plan = deliveryPlan(item, {
    route,
    workDate: workDate ?? null,
    site: site.data,
  })

  // 画面が最初に出した文面と比べる。差があれば「人が直した」＝マスタに穴がある。
  const untouched = withArrivalLine(draftAnswer(item, ctx), plan)

  const result = await writeHumanAnswer({
    requestId,
    tenantId: inquiry.tenant_id,
    model: item.model,
    channel: inquiry.channel,
    actor: session.actor,
    text,
    reasons: verdict.ok ? verdict.reasons : verdict.blockers,
    alternatives,
    deliveryPromised: plan.arrive,
    edited: isEdited(text, untouched),
    minutes: handlingMinutes(opened.data?.opened_at ?? null, new Date()),
  })
  if (!result.ok) return fail(result.reasons)

  revalidateInquiry(requestId)
  return { ok: true, data: undefined }
}

/**
 * 「自動で返せる分をまとめて返信」。画面の判定は使わず、サーバでもう一度5条件を通す。
 * 画面を開いている間に履歴や在庫が変わっていることがあるため。
 */
export async function autoAnswerReady(): Promise<
  ActionResult<{ answered: number; held: number }>
> {
  const session = await requireStaff()
  const supabase = createClient()

  const { data: open, error } = await supabase
    .from('requests')
    .select('id')
    .in('tenant_id', session.tenantIds)
    .eq('status', 'SENT')
    .is('archived_at', null)
  if (error) return fail([error.message])

  let answered = 0
  let held = 0
  for (const row of open ?? []) {
    const result = await tryAutoAnswer(row.id, session.actor)
    if (result.answered) answered += 1
    else held += 1
  }

  revalidateInquiry()
  return { ok: true, data: { answered, held } }
}

/** 電話・FAX・メールで受けた分を、同じ1件の問い合わせにする。 */
export async function createIntake(input: unknown): Promise<ActionResult<{ requestId: string }>> {
  const session = await requireStaff()
  const parsed = intakeSchema.safeParse(input)
  if (!parsed.success) return issues(parsed.error)

  const data = parsed.data
  if (!ownsTenant(session, data.tenantId)) {
    const reasons = ['この取引先の受付担当ではありません']
    await recordDenied({
      tenantId: data.tenantId,
      actor: session.actor,
      action: 'INTAKE',
      entity: 'requests',
      reasons,
    })
    return fail(reasons)
  }

  const supabase = createClient()

  // 同じキーで既に起票していたら、それを返す。押し直しでも増えない。
  const { data: existing } = await supabase
    .from('requests')
    .select('id')
    .eq('idempotency_key', data.idempotencyKey)
    .maybeSingle()
  if (existing) return { ok: true, data: { requestId: existing.id } }

  const [{ data: product }, { data: site }] = await Promise.all([
    supabase
      .from('products')
      .select('*')
      .eq('id', data.productId)
      .eq('tenant_id', data.tenantId)
      .maybeSingle(),
    data.siteId
      ? supabase
        .from('sites')
        .select('id')
        .eq('id', data.siteId)
        .eq('tenant_id', data.tenantId)
        .maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  if (!product) return fail(['商品が見つかりません'])
  if (data.siteId && !site) return fail(['現場が見つかりません'])

  const { data: request, error } = await supabase
    .from('requests')
    .insert({
      tenant_id: data.tenantId,
      site_id: data.siteId ?? null,
      kind: 'QUOTE',
      status: 'SENT',
      channel: data.channel,
      from_company: data.fromCompany,
      from_person: data.fromPerson || null,
      need_by: data.needBy ?? null,
      note: data.note || null,
      idempotency_key: data.idempotencyKey,
    })
    .select('id')
    .single()
  if (error || !request) return fail([error?.message ?? '起票できませんでした'])

  const { error: itemError } = await supabase.from('request_items').insert({
    tenant_id: data.tenantId,
    request_id: request.id,
    product_id: product.id,
    maker: product.maker,
    model: product.model,
    name: product.name,
    category: product.category,
    qty: data.qty,
    // 受けた時点の値を残す。あとでマスタが変わっても遡って書き換えない（genba と同じ）。
    unit_price: product.unit_price,
    stock: product.stock,
    lead_days: product.lead_days,
    verified: product.verified,
    position: 0,
  })
  if (itemError) return fail([itemError.message])

  await recordAudit({
    tenantId: data.tenantId,
    actor: session.actor,
    action: 'INTAKE',
    entity: 'requests',
    entityId: request.id,
    after: { channel: data.channel, model: product.model, qty: data.qty },
  })

  revalidateInquiry()
  return { ok: true, data: { requestId: request.id } }
}

/** 聞かれた型番と、人が出した正解を登録する。次から自動で当たる。 */
export async function addAlias(input: unknown): Promise<ActionResult> {
  const session = await requireStaff()
  const parsed = aliasSchema.safeParse(input)
  if (!parsed.success) return issues(parsed.error)

  const { tenantId, fromModel, toModel, reason, requestId } = parsed.data
  if (!ownsTenant(session, tenantId)) return fail(['この取引先の受付担当ではありません'])
  if (fromModel.toUpperCase() === toModel.toUpperCase()) {
    return fail(['元の型番と後継品が同じです'])
  }

  const supabase = createClient()
  const { data: alias, error } = await supabase
    .from('model_aliases')
    .insert({
      tenant_id: tenantId,
      from_model: fromModel,
      to_model: toModel,
      reason: reason || null,
      created_by: session.actor,
      request_id: requestId ?? null,
    })
    .select('id')
    .single()

  if (error) {
    return fail([
      error.code === '23505' ? 'この組み合わせはすでに登録されています' : error.message,
    ])
  }

  await recordAudit({
    tenantId,
    actor: session.actor,
    action: 'ALIAS_ADDED',
    entity: 'model_aliases',
    entityId: alias.id,
    after: { from_model: fromModel, to_model: toModel, request_id: requestId ?? null },
  })

  revalidatePath('/aliases')
  revalidatePath('/effect')
  if (requestId) revalidatePath(`/inbox/${requestId}`)
  return { ok: true, data: undefined }
}

/** 取り消しは archived_at。資産なので物理削除はしない（DB でも止めている）。 */
export async function archiveAlias(aliasId: string): Promise<ActionResult> {
  const session = await requireStaff()
  const supabase = createClient()

  const { data: alias } = await supabase
    .from('model_aliases')
    .select('id, tenant_id, from_model, to_model')
    .eq('id', aliasId)
    .is('archived_at', null)
    .maybeSingle()
  if (!alias) return fail(['登録が見つかりません'])

  const { error } = await supabase
    .from('model_aliases')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', aliasId)
  if (error) return fail([error.message])

  await recordAudit({
    tenantId: alias.tenant_id,
    actor: session.actor,
    action: 'ALIAS_ARCHIVED',
    entity: 'model_aliases',
    entityId: aliasId,
    before: { from_model: alias.from_model, to_model: alias.to_model },
  })

  revalidatePath('/aliases')
  revalidatePath('/effect')
  return { ok: true, data: undefined }
}

/**
 * 発注済みの納期が変わったことを、その発注についてだけ知らせる。
 * 工事会社の画面に「納期が変わりました」が出て、確認したら delivery_seen が立つ。
 * 催促の電話をなくすための往復。
 */
export async function notifyDeliveryChange(input: unknown): Promise<ActionResult> {
  const session = await requireStaff()
  const parsed = deliveryChangeSchema.safeParse(input)
  if (!parsed.success) return issues(parsed.error)

  const { requestId, changedTo, reason } = parsed.data
  const inquiry = await getInquiry(session, requestId)
  if (!inquiry) return fail(['依頼が見つかりません'])

  if (inquiry.status !== 'ORDERED') {
    const reasons = ['発注済みのものだけ、納期の変更を知らせられます']
    await recordDenied({
      tenantId: inquiry.tenant_id,
      actor: session.actor,
      action: 'DELIVERY_CHANGED',
      entity: 'requests',
      entityId: requestId,
      reasons,
      after: { status: inquiry.status },
    })
    return fail(reasons)
  }
  if (changedTo < today()) return fail(['過去の日付には変更できません'])

  // 2回目の変更は、直前に知らせた日からの変更として見せる。
  const current = inquiry.delivery_changed_to ?? inquiry.delivery_promised ?? inquiry.need_by
  if (current === changedTo) return fail(['いまの納期と同じ日です'])

  const supabase = createClient()
  const { error } = await supabase
    .from('requests')
    .update({
      delivery_promised: current,
      delivery_changed_to: changedTo,
      delivery_reason: reason,
      delivery_notified_at: new Date().toISOString(),
      delivery_seen: false,
    })
    .eq('id', requestId)
  if (error) return fail([error.message])

  await recordAudit({
    tenantId: inquiry.tenant_id,
    actor: session.actor,
    action: 'DELIVERY_CHANGED',
    entity: 'requests',
    entityId: requestId,
    before: { delivery: current },
    after: { delivery: changedTo, reason },
  })

  revalidateInquiry(requestId)
  return { ok: true, data: undefined }
}
