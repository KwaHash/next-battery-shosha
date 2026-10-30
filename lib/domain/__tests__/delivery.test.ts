import { describe, expect, it } from 'vitest'
import { type Clock } from '@/lib/domain/clock'
import { arrivalLine, deliveryPlan, isEdited, withArrivalLine } from '@/lib/domain/delivery'

// 2026-10-12（月）9:00 JST。
const clock: Clock = { now: () => new Date('2026-10-12T00:00:00Z') }
// UTC 23:30 は JST では翌日。toISOString() で日付を取ると前日になる時刻。
const lateNight: Clock = { now: () => new Date('2026-10-11T23:30:00Z') }

const inStock = { qty: 20, stock: 42, lead_days: 1 }
const short = { qty: 20, stock: 8, lead_days: 4 }

describe('deliveryPlan（現場に着く日）', () => {
  it('在庫があれば出荷0日＋物流日数', () => {
    const plan = deliveryPlan(inStock, { route: 'DIRECT' }, clock)
    expect(plan.arrive).toBe('2026-10-13')
    expect(plan.source).toBe('自社在庫から出荷')
  })

  it('在庫が足りなければメーカー手配の日数を足す', () => {
    const plan = deliveryPlan(short, { route: 'HUB' }, clock)
    expect(plan.shipDays).toBe(4)
    expect(plan.arrive).toBe('2026-10-18')
    expect(plan.source).toBe('メーカー手配（4営業日）')
  })

  it('日付は Asia/Tokyo で数える', () => {
    expect(deliveryPlan(inStock, {}, lateNight).arrive).toBe('2026-10-13')
  })

  it('推奨着荷は施工の前日', () => {
    const plan = deliveryPlan(inStock, { workDate: '2026-10-15' }, clock)
    expect(plan.recommended).toBe('2026-10-14')
    expect(plan.warnings).toEqual([])
  })

  it('間に合わなければ止める警告を出す', () => {
    const plan = deliveryPlan(short, { route: 'KITTING', workDate: '2026-10-15' }, clock)
    expect(plan.warnings[0].tone).toBe('danger')
    expect(plan.warnings[0].text).toContain('間に合いません')
  })

  it('前日着ちょうどなら警告しない', () => {
    const plan = deliveryPlan(inStock, { route: 'DIRECT', workDate: '2026-10-14' }, clock)
    expect(plan.warnings).toEqual([])
  })

  it('早すぎる着荷は拠点で預かる提案をする', () => {
    const plan = deliveryPlan(inStock, { workDate: '2026-10-25' }, clock)
    expect(plan.warnings).toEqual([
      { tone: 'warn', text: '着荷が早すぎます。現場に置き場がなければ、拠点で預かって前日出荷にできます' },
    ])
  })

  it('現場の受取条件を出す', () => {
    const plan = deliveryPlan(inStock, { site: { receive_note: '平日8時〜17時。搬入口は北側' } }, clock)
    expect(plan.warnings).toEqual([{ tone: 'warn', text: '受取条件：平日8時〜17時。搬入口は北側' }])
  })
})

describe('回答文の現場着の行', () => {
  const plan = deliveryPlan(inStock, { route: 'DIRECT' }, clock)
  const hub = deliveryPlan(inStock, { route: 'HUB' }, clock)

  it('無ければ末尾に足す', () => {
    expect(withArrivalLine('在庫あります。', plan)).toBe(`在庫あります。\n${arrivalLine(plan)}`)
  })

  it('あれば差し替え、担当者が書き足した部分は残す', () => {
    const edited = `${withArrivalLine('在庫あります。', plan)}\n\n【代替のご提案】…`
    const next = withArrivalLine(edited, hub)
    expect(next).toContain('現場着：10月14日（水）・拠点経由')
    expect(next).not.toContain('現場直送')
    expect(next).toContain('【代替のご提案】')
  })

  it('空白と改行だけの違いは、直したことにしない', () => {
    expect(isEdited('在庫あります。\n単価 100円', '在庫あります。 単価 100円 ')).toBe(false)
    expect(isEdited('在庫あります。単価 90円', '在庫あります。単価 100円')).toBe(true)
  })
})
