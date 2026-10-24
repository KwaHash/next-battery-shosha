import { type Clock, type IsoDate, addDays, formatDate, systemClock, today } from '@/lib/domain/clock'
import { type RequestItemRow, type SiteRow } from '@/types/database'

/**
 * 納期は「メーカーが出す日」ではなく「現場に着く日」で返す。
 *
 *   メーカー出荷日 ＋ 自社物流のリードタイム ＋ 現場の受取条件 ＝ 現場着日
 *
 * ここが商社の付加価値。メーカーの納期をそのまま伝えるだけなら商社は要らない（docs/26）。
 * 物流の日数は仮値。物流部の実測に置き換える（T-3）。
 */
export const LOGISTICS = {
  DIRECT: { label: '現場直送', days: 1, note: '拠点を通さない。最短' },
  HUB: { label: '拠点経由', days: 2, note: '検品・仕分けが入る' },
  KITTING: { label: '拠点でキッティング', days: 2, note: '定尺切断・番号シール・施工順梱包' },
} as const

export type LogisticsRoute = keyof typeof LOGISTICS

export const LOGISTICS_ROUTES = ['DIRECT', 'HUB', 'KITTING'] as const satisfies readonly LogisticsRoute[]

export type DeliveryItem = Pick<RequestItemRow, 'qty' | 'stock' | 'lead_days'>

export type DeliveryWarning = {
  tone: 'danger' | 'warn';
  text: string;
}

export type DeliveryPlan = {
  route: LogisticsRoute;
  routeLabel: string;
  routeNote: string;
  shipDays: number;
  logisticsDays: number;
  arrive: IsoDate;
  recommended: IsoDate | null;
  warnings: DeliveryWarning[];
  source: string;
}

export function deliveryPlan(
  item: DeliveryItem,
  opts: {
    route?: LogisticsRoute;
    workDate?: IsoDate | null;
    site?: Pick<SiteRow, 'receive_note'> | null;
  } = {},
  clock: Clock = systemClock,
): DeliveryPlan {
  const route = opts.route ?? 'DIRECT'
  const logistics = LOGISTICS[route]
  const enough = item.stock >= item.qty
  const shipDays = enough ? 0 : item.lead_days || 0
  const arrive = addDays(today(0, clock), shipDays + logistics.days)

  const warnings: DeliveryWarning[] = []
  let recommended: IsoDate | null = null

  if (opts.workDate) {
    // 早すぎると現場に置き場がない。遅いと工事が止まる。前日着が基本。
    recommended = addDays(opts.workDate, -1)
    if (arrive > recommended) {
      warnings.push({
        tone: 'danger',
        text: `施工予定（${formatDate(opts.workDate)}）に間に合いません。分納か、代替品の検討が要ります`,
      })
    } else if (arrive < addDays(opts.workDate, -4)) {
      warnings.push({
        tone: 'warn',
        text: '着荷が早すぎます。現場に置き場がなければ、拠点で預かって前日出荷にできます',
      })
    }
  }

  if (opts.site?.receive_note) {
    warnings.push({ tone: 'warn', text: `受取条件：${opts.site.receive_note}` })
  }

  return {
    route,
    routeLabel: logistics.label,
    routeNote: logistics.note,
    shipDays,
    logisticsDays: logistics.days,
    arrive,
    recommended,
    warnings,
    source: enough ? '自社在庫から出荷' : `メーカー手配（${item.lead_days}営業日）`,
  }
}

const ARRIVAL_PREFIX = '現場着：'
const ARRIVAL_LINE = /^現場着：.*$/m

export function arrivalLine(plan: Pick<DeliveryPlan, 'arrive' | 'routeLabel'>): string {
  return `${ARRIVAL_PREFIX}${formatDate(plan.arrive)}・${plan.routeLabel}`
}

/**
 * 下書きの文面に現場着日の行を入れる。すでにあれば差し替える。
 * 担当者が書き足した部分は残す。
 */
export function withArrivalLine(
  text: string,
  plan: Pick<DeliveryPlan, 'arrive' | 'routeLabel'>,
): string {
  const line = arrivalLine(plan)
  if (ARRIVAL_LINE.test(text)) return text.replace(ARRIVAL_LINE, line)
  return text.trimEnd() ? `${text.trimEnd()}\n${line}` : line
}

/** 担当者が手を入れたかどうか。空白と改行の違いは直したことにしない。 */
export function isEdited(sent: string, untouched: string): boolean {
  const normalize = (s: string) => s.replace(/\s+/g, ' ').trim()
  return normalize(sent) !== normalize(untouched)
}
