import 'server-only'

import { type RequestItemRow } from '@/types/database'

/**
 * 自動回答の判定。AIは呼ばない。ルールベースで、判定の根拠を必ず返す。
 *
 * **現場アシスト（next-battery-genba）の `lib/domain/auto-answer.ts` と同じ判定です。**
 * 片方だけ変えないでください。現場側が送信時に出した判定と、受付で出す判定が食い違うと、
 * 「なぜ人が確認するのか」の説明が画面ごとに変わってしまいます。
 * DB のトリガー（guard_request_answer）も同じ条件で守っています。
 *
 * 次の5つを全部満たしたときだけ自動で返す。1つでも欠けたら人へ。
 *   1. 保安に関わる機器でない（何があっても人）
 *   2. 同じ型番に、**人が承認した**回答の履歴がある（初回は必ず人）
 *   3. 在庫で引き当てられる
 *   4. 数量50個以下・金額30万円以下
 *   5. 適合確認済みの商品
 */

export const SAFETY_KEYWORDS = [
  '漏電遮断器',
  '漏電',
  '遮断器',
  'ブレーカ',
  '保護継電器',
  '継電器',
  'ELCB',
  'MCCB',
] as const

export const AUTO_MAX_QTY = 50
export const AUTO_MAX_AMOUNT = 300_000

export type AnswerableItem = Pick<
  RequestItemRow,
  'name' | 'model' | 'category' | 'qty' | 'stock' | 'unit_price' | 'lead_days' | 'verified'
>

export type AutoAnswerContext = {
  answeredBefore: boolean;
  aliases?: { from_model: string; to_model: string }[];
}

export type AutoAnswerVerdict = {
  ok: boolean;
  reasons: string[];
  blockers: string[];
}

export function isSafetyItem(item: AnswerableItem): boolean {
  const haystack = `${item.name || ''} ${item.model || ''} ${item.category || ''}`
  return SAFETY_KEYWORDS.some((keyword) => haystack.includes(keyword))
}

export function canAutoAnswer(
  item: AnswerableItem,
  ctx: AutoAnswerContext,
): AutoAnswerVerdict {
  const reasons: string[] = []
  const blockers: string[] = []

  if (isSafetyItem(item)) {
    blockers.push('保安に関わる機器です。必ず人が確認します')
  } else {
    reasons.push('保安機器ではありません')
  }

  if (ctx.answeredBefore) {
    reasons.push('同じ型番に、人が承認した回答の履歴があります')
  } else {
    blockers.push('この型番の回答履歴がありません（初回は人が確認します）')
  }

  if (item.stock >= item.qty) {
    reasons.push(`在庫で引き当てられます（在庫 ${item.stock}／必要 ${item.qty}）`)
  } else {
    blockers.push('在庫が不足しています。納期の判断が要ります')
  }

  const amount = (item.unit_price || 0) * (item.qty || 0)
  if (item.qty <= AUTO_MAX_QTY && amount <= AUTO_MAX_AMOUNT) {
    reasons.push('数量・金額が自動回答の範囲内です')
  } else {
    blockers.push(
      `大口のため人が確認します（${item.qty}個／${amount.toLocaleString('ja-JP')}円）`,
    )
  }

  if (item.verified) {
    reasons.push('適合確認済みの商品です')
  } else {
    blockers.push('適合が未確認の商品です')
  }

  return { ok: blockers.length === 0, reasons, blockers }
}

/** 回答の下書き。文面は定型。担当者は直すだけ。 */
export function draftAnswer(item: AnswerableItem, ctx: AutoAnswerContext): string {
  const lines: string[] = []

  if (item.stock >= item.qty) {
    lines.push('在庫あります。本日15時までのご注文で翌営業日着です。')
  } else if (item.stock > 0) {
    lines.push(
      `在庫が${item.stock}個です。不足分は${item.lead_days}営業日で入荷します。分納も可能です。`,
    )
  } else {
    lines.push(`在庫切れです。${item.lead_days}営業日で入荷予定です。`)
  }

  lines.push(`単価 ${Number(item.unit_price || 0).toLocaleString('ja-JP')}円（税別）。`)

  const alias = (ctx.aliases || []).find((a) => a.to_model === item.model)
  if (alias) lines.push(`※ ${alias.from_model} の後継品です。`)
  if (!item.verified) lines.push('※ 適合は未確認です。取付寸法をご確認ください。')

  return lines.join('\n')
}
