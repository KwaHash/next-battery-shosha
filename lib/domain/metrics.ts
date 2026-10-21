import { type Clock, type IsoDate, addDays, systemClock, toJstDate, today } from '@/lib/domain/clock'
import { type RequestRow } from '@/types/database'

/**
 * 省人化の効果（docs/25 §8）。
 *
 * 電話・FAXでの従来対応を1件12分と置いた比較。**12分は仮値。実測で置き換える。**
 */
export const BASELINE_MINUTES = 12

export type AnswerRecord = {
  mode: 'AUTO' | 'HUMAN';
  /** 担当者が下書きを直したか。履歴が無い（受付アシスト以前の回答）なら null */
  edited: boolean | null;
  /** 対応にかかった分。自動は0。履歴が無ければ null */
  minutes: number | null;
}

export type AnswerMetrics = {
  total: number;
  auto: number;
  human: number;
  autoRate: number;
  editedRate: number;
  avgMinutes: number;
  savedMinutes: number;
  /** 対応時間が測れていない件数。平均には入れない */
  unmeasured: number;
}

function percent(n: number, d: number): number {
  return d ? Number(((n / d) * 100).toFixed(1)) : 0
}

export function answerMetrics(records: AnswerRecord[]): AnswerMetrics {
  const total = records.length
  const auto = records.filter((r) => r.mode === 'AUTO').length
  const edited = records.filter((r) => r.mode === 'HUMAN' && r.edited).length

  // 自動は0分。人の回答で時間が残っていないものは、測れていないので平均から外す。
  const measured = records
    .map((r) => (r.mode === 'AUTO' ? 0 : r.minutes))
    .filter((m): m is number => m !== null)
  const minutes = measured.reduce((sum, m) => sum + m, 0)

  return {
    total,
    auto,
    human: total - auto,
    autoRate: percent(auto, total),
    editedRate: percent(edited, total),
    avgMinutes: measured.length ? Number((minutes / measured.length).toFixed(1)) : 0,
    savedMinutes: Math.round(measured.length * BASELINE_MINUTES - minutes),
    unmeasured: total - measured.length,
  }
}

/** 放置していた時間を対応時間に数えない。開いたまま翌日に返した1件で平均が壊れるため。 */
export const MAX_HANDLING_MINUTES = 60

export function handlingMinutes(openedAt: string | null, answeredAt: Date): number | null {
  if (!openedAt) return null
  const elapsed = (answeredAt.getTime() - new Date(openedAt).getTime()) / 60_000
  if (!Number.isFinite(elapsed) || elapsed < 0) return null
  return Number(Math.min(MAX_HANDLING_MINUTES, Math.max(0.5, elapsed)).toFixed(1))
}

type ChannelRequest = Pick<RequestRow, 'channel' | 'created_at' | 'answer_mode'>

export type ChannelShare = {
  channel: RequestRow['channel'];
  count: number;
  share: number;
}

export function channelBreakdown(requests: ChannelRequest[]): ChannelShare[] {
  const counts = new Map<RequestRow['channel'], number>()
  for (const r of requests) counts.set(r.channel, (counts.get(r.channel) ?? 0) + 1)

  return Array.from(counts.entries())
    .map(([channel, count]) => ({ channel, count, share: percent(count, requests.length) }))
    .sort((a, b) => b.count - a.count)
}

/** 人が受けて起票する経路。ここが減っていれば省人化が進んでいる。 */
export const MANUAL_CHANNELS: readonly RequestRow['channel'][] = ['PHONE', 'FAX']

export type WeekRow = {
  weekStart: IsoDate;
  total: number;
  manual: number;
  manualShare: number;
  auto: number;
}

/** 月曜始まり（Asia/Tokyo）の週。 */
export function weekStartOf(date: IsoDate): IsoDate {
  const [y, m, d] = date.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return addDays(date, -((dow + 6) % 7))
}

export function weeklyTrend(
  requests: ChannelRequest[],
  weeks = 8,
  clock: Clock = systemClock,
): WeekRow[] {
  const current = weekStartOf(today(0, clock))
  const rows: WeekRow[] = []

  for (let i = weeks - 1; i >= 0; i--) {
    rows.push({ weekStart: addDays(current, -7 * i), total: 0, manual: 0, manualShare: 0, auto: 0 })
  }

  const byWeek = new Map(rows.map((row) => [row.weekStart, row]))
  for (const r of requests) {
    const day = toJstDate(r.created_at)
    if (!day) continue
    const row = byWeek.get(weekStartOf(day))
    if (!row) continue
    row.total += 1
    if (MANUAL_CHANNELS.includes(r.channel)) row.manual += 1
    if (r.answer_mode === 'AUTO') row.auto += 1
  }

  for (const row of rows) row.manualShare = percent(row.manual, row.total)
  return rows
}
