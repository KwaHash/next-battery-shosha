import 'server-only'

import { canAutoAnswer, draftAnswer, isSafetyItem } from '@/lib/domain/auto-answer'
import { today } from '@/lib/domain/clock'
import { type StaffSession, tenantName } from '@/lib/shosha/session'
import { createClient } from '@/lib/supabase/server'
import {
  type AnswerLogRow,
  type ModelAliasRow,
  type ProductRow,
  type RequestItemRow,
  type RequestRow,
  type SiteRow,
} from '@/types/database'
import {
  type Inbox,
  type InboxRow,
  type InquiryDetail,
  type InquiryWithItems,
  type ModelHistoryEntry,
  type Verdict,
} from '@/types/shosha'

/**
 * 読み取りはすべて受付担当のセッションで行い、RLS を通す。
 * テナントは RLS で分離し、さらに受付担当のテナントに絞る（memberships だけでは
 * 現場側の利用者と区別できないため）。
 */

const INQUIRY_SELECT = '*, items:request_items(*)'

/** 現場側から見えている依頼。DRAFT と PENDING（端末に溜まっている分）は商社に届いていない。 */
export const VISIBLE_STATUSES: RequestRow['status'][] = ['SENT', 'ANSWERED', 'ORDERED']

/** 人が承認した回答として数える状態。genba の answerRequestOnServer と同じ。 */
const APPROVED_STATUSES: RequestRow['status'][] = ['ANSWERED', 'ORDERED']

/** PostgREST の1回の上限（既定 1000 行）を越えて読む。 */
const PAGE = 1000

async function fetchAll<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1)
    // 途中までの件数で集計や書き出しをしない。欠けた数字は、無い数字より悪い。
    if (error) throw new Error(error.message)
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE) return rows
  }
}

function sortItems(rows: InquiryWithItems[]): InquiryWithItems[] {
  return rows.map((r) => ({
    ...r,
    items: [...(r.items ?? [])].sort((a, b) => a.position - b.position),
  }))
}

export function senderOf(
  inquiry: Pick<RequestRow, 'from_company' | 'tenant_id'>,
  session: StaffSession,
): string {
  return inquiry.from_company || tenantName(session, inquiry.tenant_id)
}

function key(tenantId: string, model: string): string {
  return `${tenantId}\u0000${model}`
}

function toVerdict(item: RequestItemRow, answeredBefore: boolean): Verdict {
  const { ok, reasons, blockers } = canAutoAnswer(item, { answeredBefore })
  return { ok, reasons, blockers, safety: isSafetyItem(item) }
}

/** 同じ型番に、人が承認した回答があるテナント×型番の組。 */
async function humanApprovedModels(
  tenantIds: string[],
  models: string[],
): Promise<Set<string>> {
  if (!tenantIds.length || !models.length) return new Set()

  const supabase = createClient()
  const rows = await fetchAll((from, to) =>
    supabase
      .from('request_items')
      .select('tenant_id, model, requests!inner(answer_mode, status)')
      .in('tenant_id', tenantIds)
      .in('model', models)
      .eq('requests.answer_mode', 'HUMAN')
      .in('requests.status', APPROVED_STATUSES)
      .range(from, to),
  )
  return new Set(rows.map((r) => key(r.tenant_id, r.model)))
}

function toInboxRow(
  inquiry: InquiryWithItems,
  session: StaffSession,
  approved: Set<string>,
): InboxRow | null {
  const item = inquiry.items[0]
  if (!item) return null

  return {
    id: inquiry.id,
    tenantName: tenantName(session, inquiry.tenant_id),
    status: inquiry.status,
    channel: inquiry.channel,
    from: senderOf(inquiry, session),
    person: inquiry.from_person,
    maker: item.maker,
    model: item.model,
    name: item.name,
    qty: item.qty,
    amount: item.unit_price * item.qty,
    needBy: inquiry.need_by,
    createdAt: inquiry.created_at,
    answerMode: inquiry.answer_mode,
    answerAt: inquiry.answer_at,
    deliveryChanged: Boolean(inquiry.delivery_changed_to),
    deliverySeen: inquiry.delivery_seen,
    verdict:
      inquiry.status === 'SENT'
        ? toVerdict(item, approved.has(key(inquiry.tenant_id, item.model)))
        : null,
  }
}

export const DONE_LIMIT = 200

export async function getInbox(session: StaffSession): Promise<Inbox> {
  const supabase = createClient()

  const [open, done] = await Promise.all([
    fetchAll((from, to) =>
      supabase
        .from('requests')
        .select(INQUIRY_SELECT)
        .in('tenant_id', session.tenantIds)
        .eq('status', 'SENT')
        .is('archived_at', null)
        .order('created_at', { ascending: true })
        .range(from, to),
    ),
    supabase
      .from('requests')
      .select(INQUIRY_SELECT)
      .in('tenant_id', session.tenantIds)
      .in('status', ['ANSWERED', 'ORDERED'])
      .is('archived_at', null)
      .order('answer_at', { ascending: false, nullsFirst: false })
      .limit(DONE_LIMIT),
  ])

  const openRows = sortItems(open)
  const doneRows = sortItems((done.data ?? []))

  const models = Array.from(
    new Set(openRows.flatMap((r) => (r.items[0] ? [r.items[0].model] : []))),
  )
  const approved = await humanApprovedModels(session.tenantIds, models)

  return {
    open: openRows
      .map((r) => toInboxRow(r, session, approved))
      .filter((r): r is InboxRow => r !== null),
    done: doneRows
      .map((r) => toInboxRow(r, session, approved))
      .filter((r): r is InboxRow => r !== null),
  }
}

export async function getInquiry(
  session: StaffSession,
  id: string,
): Promise<InquiryWithItems | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('requests')
    .select(INQUIRY_SELECT)
    .eq('id', id)
    .in('tenant_id', session.tenantIds)
    .maybeSingle()
  return data ? sortItems([data])[0] : null
}

/**
 * 同じ型番に、人が承認した回答があるか。genba の answerRequestOnServer と同じ数え方。
 * 自動回答した履歴は数えない。数えると、1件目の自動回答が2件目の根拠になり、
 * 「初回は人」という条件が1回で溶ける。
 */
export async function countHumanApprovals(
  tenantId: string,
  model: string,
  excludeRequestId: string,
): Promise<number> {
  const supabase = createClient()
  const { count } = await supabase
    .from('request_items')
    .select('id, requests!inner(status, answer_mode)', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('model', model)
    .neq('request_id', excludeRequestId)
    .eq('requests.answer_mode', 'HUMAN')
    .in('requests.status', APPROVED_STATUSES)
  return count ?? 0
}

async function modelHistory(
  session: StaffSession,
  tenantId: string,
  model: string,
  excludeRequestId: string,
): Promise<ModelHistoryEntry[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('request_items')
    .select(
      'request_id, qty, requests!inner(status, answer_mode, answer_by, answer_at, answer_text, from_company, tenant_id)',
    )
    .eq('tenant_id', tenantId)
    .eq('model', model)
    .neq('request_id', excludeRequestId)
    .in('requests.status', APPROVED_STATUSES)
    .order('created_at', { ascending: false })
    .limit(5)

  return (data ?? []).map((row) => {
    const request = row.requests as unknown as Pick<
      RequestRow,
      'answer_mode' | 'answer_by' | 'answer_at' | 'answer_text' | 'from_company' | 'tenant_id'
    >
    return {
      requestId: row.request_id,
      from: senderOf(request, session),
      qty: row.qty,
      answerMode: request.answer_mode,
      answerBy: request.answer_by,
      answerAt: request.answer_at,
      answerText: request.answer_text,
    }
  })
}

export async function listAliases(tenantIds: string[]): Promise<ModelAliasRow[]> {
  if (!tenantIds.length) return []
  const supabase = createClient()
  const { data } = await supabase
    .from('model_aliases')
    .select('*')
    .in('tenant_id', tenantIds)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function listProducts(tenantIds: string[]): Promise<ProductRow[]> {
  if (!tenantIds.length) return []
  const supabase = createClient()
  return fetchAll((from, to) =>
    supabase
      .from('products')
      .select('*')
      .in('tenant_id', tenantIds)
      .is('archived_at', null)
      .order('maker', { ascending: true })
      .order('model', { ascending: true })
      .range(from, to),
  )
}

export async function listSites(tenantIds: string[]): Promise<SiteRow[]> {
  if (!tenantIds.length) return []
  const supabase = createClient()
  const { data } = await supabase
    .from('sites')
    .select('*')
    .in('tenant_id', tenantIds)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function getInquiryDetail(
  session: StaffSession,
  id: string,
): Promise<InquiryDetail | null> {
  const inquiry = await getInquiry(session, id)
  const item = inquiry?.items[0]
  if (!inquiry || !item) return null

  const supabase = createClient()
  const [site, aliases, products, history, humanApprovals, log, opened] = await Promise.all([
    inquiry.site_id
      ? supabase.from('sites').select('*').eq('id', inquiry.site_id).maybeSingle()
      : Promise.resolve({ data: null }),
    listAliases([inquiry.tenant_id]),
    listProducts([inquiry.tenant_id]),
    modelHistory(session, inquiry.tenant_id, item.model, inquiry.id),
    countHumanApprovals(inquiry.tenant_id, item.model, inquiry.id),
    supabase.from('answer_logs').select('*').eq('request_id', inquiry.id).maybeSingle(),
    supabase.from('request_opens').select('opened_at').eq('request_id', inquiry.id).maybeSingle(),
  ])

  const ctx = { answeredBefore: humanApprovals > 0, aliases }

  return {
    inquiry,
    item,
    tenantName: tenantName(session, inquiry.tenant_id),
    from: senderOf(inquiry, session),
    site: (site.data) ?? null,
    verdict: toVerdict(item, ctx.answeredBefore),
    draft: draftAnswer(item, ctx),
    aliases,
    products,
    history,
    humanApprovals,
    log: (log.data) ?? null,
    openedAt: opened.data?.opened_at ?? null,
    today: today(),
  }
}

export type MetricsSource = {
  requests: Pick<RequestRow, 'id' | 'channel' | 'created_at' | 'answer_mode' | 'status'>[];
  logs: Pick<AnswerLogRow, 'request_id' | 'mode' | 'edited' | 'minutes'>[];
  aliasCount: number;
}

export async function getMetricsSource(session: StaffSession): Promise<MetricsSource> {
  const supabase = createClient()

  const [requests, logs, aliases] = await Promise.all([
    fetchAll((from, to) =>
      supabase
        .from('requests')
        .select('id, channel, created_at, answer_mode, status')
        .in('tenant_id', session.tenantIds)
        .in('status', VISIBLE_STATUSES)
        .is('archived_at', null)
        .order('created_at', { ascending: true })
        .range(from, to),
    ),
    fetchAll((from, to) =>
      supabase
        .from('answer_logs')
        .select('request_id, mode, edited, minutes')
        .in('tenant_id', session.tenantIds)
        .order('created_at', { ascending: true })
        .range(from, to),
    ),
    supabase
      .from('model_aliases')
      .select('id', { count: 'exact', head: true })
      .in('tenant_id', session.tenantIds)
      .is('archived_at', null),
  ])

  return { requests, logs, aliasCount: aliases.count ?? 0 }
}

/** CSV の書き出し用。回答済みを含む全件。 */
export async function listInquiriesForExport(
  session: StaffSession,
): Promise<InquiryWithItems[]> {
  const supabase = createClient()
  const rows = await fetchAll((from, to) =>
    supabase
      .from('requests')
      .select(INQUIRY_SELECT)
      .in('tenant_id', session.tenantIds)
      .in('status', VISIBLE_STATUSES)
      .order('created_at', { ascending: true })
      .range(from, to),
  )
  return sortItems(rows)
}
