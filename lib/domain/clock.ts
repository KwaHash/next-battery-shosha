export const TIME_ZONE = 'Asia/Tokyo'

export type Clock = {
  now: () => Date;
}

export const systemClock: Clock = { now: () => new Date() }

export type IsoDate = string

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function today(offsetDays = 0, clock: Clock = systemClock): IsoDate {
  const base = formatter.format(clock.now())
  return offsetDays === 0 ? base : addDays(base, offsetDays)
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const [y, m, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  t.setUTCDate(t.getUTCDate() + days)
  return t.toISOString().slice(0, 10)
}

export function isExpired(
  expiresOn: IsoDate | null | undefined,
  clock: Clock = systemClock,
): boolean {
  if (!expiresOn) return false
  return expiresOn < today(0, clock)
}

export function isDueBy(
  due: IsoDate | null | undefined,
  offsetDays = 0,
  clock: Clock = systemClock,
): boolean {
  if (!due) return true
  return due <= today(offsetDays, clock)
}

export function toJstDate(iso: string | null | undefined): IsoDate | null {
  if (!iso) return null
  return formatter.format(new Date(iso))
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const
export function weekdayOf(date: IsoDate): string {
  const [y, m, d] = date.split('-').map(Number)
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
}

/** 「8月26日 14:30」の形。 */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: TIME_ZONE,
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function formatDate(date: IsoDate | null | undefined): string {
  if (!date) return '—'
  const [, m, d] = date.split('-').map(Number)
  return `${m}月${d}日（${weekdayOf(date)}）`
}

export function yen(n: number | null | undefined): string {
  return `${Number(n || 0).toLocaleString('ja-JP')}円`
}

export const ISO_DATE_FORMAT = 'yyyy-MM-dd'

export function parseIsoDate(value: string | null | undefined): Date | undefined {
  if (!value) return undefined
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return undefined

  const date = new Date(y, m - 1, d)
  const roundTrips =
    date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
  return roundTrips ? date : undefined
}

export function formatIsoDate(date: Date): IsoDate {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
