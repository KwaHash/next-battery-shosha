import { describe, expect, it } from 'vitest'
import { type Clock } from '@/lib/domain/clock'
import {
  answerMetrics,
  BASELINE_MINUTES,
  channelBreakdown,
  handlingMinutes,
  MAX_HANDLING_MINUTES,
  weekStartOf,
  weeklyTrend,
} from '@/lib/domain/metrics'

describe('answerMetrics', () => {
  it('記録がなければすべて0', () => {
    expect(answerMetrics([])).toMatchObject({ total: 0, autoRate: 0, avgMinutes: 0, savedMinutes: 0 })
  })

  it('自動は0分として数え、人の回答は記録した時間で数える', () => {
    const m = answerMetrics([
      { mode: 'AUTO', edited: false, minutes: 0 },
      { mode: 'HUMAN', edited: true, minutes: 4 },
      { mode: 'HUMAN', edited: false, minutes: 2 },
      { mode: 'AUTO', edited: false, minutes: 0 },
    ])
    expect(m.total).toBe(4)
    expect(m.autoRate).toBe(50)
    expect(m.editedRate).toBe(25)
    expect(m.avgMinutes).toBe(1.5)
    expect(m.savedMinutes).toBe(4 * BASELINE_MINUTES - 6)
  })

  it('時間の記録がない回答は平均と削減時間から外す', () => {
    const m = answerMetrics([
      { mode: 'HUMAN', edited: null, minutes: null },
      { mode: 'HUMAN', edited: false, minutes: 3 },
    ])
    expect(m.unmeasured).toBe(1)
    expect(m.avgMinutes).toBe(3)
    expect(m.savedMinutes).toBe(BASELINE_MINUTES - 3)
  })
})

describe('handlingMinutes', () => {
  const answered = new Date('2026-10-12T01:10:00Z')

  it('開いてから返すまでの分', () => {
    expect(handlingMinutes('2026-10-12T01:04:00Z', answered)).toBe(6)
  })

  it('短すぎても0.5分とする', () => {
    expect(handlingMinutes('2026-10-12T01:09:59Z', answered)).toBe(0.5)
  })

  it('放置していた時間は上限で切る', () => {
    expect(handlingMinutes('2026-10-11T01:00:00Z', answered)).toBe(MAX_HANDLING_MINUTES)
  })

  it('開いた記録がなければ測れない', () => {
    expect(handlingMinutes(null, answered)).toBeNull()
  })
})

describe('経路の内訳', () => {
  it('多い順に並べ、割合を出す', () => {
    const rows = channelBreakdown([
      { channel: 'PHONE', created_at: '', answer_mode: null },
      { channel: 'WEB', created_at: '', answer_mode: null },
      { channel: 'WEB', created_at: '', answer_mode: null },
      { channel: 'WEB', created_at: '', answer_mode: null },
    ])
    expect(rows).toEqual([
      { channel: 'WEB', count: 3, share: 75 },
      { channel: 'PHONE', count: 1, share: 25 },
    ])
  })
})

describe('週ごとの推移', () => {
  const clock: Clock = { now: () => new Date('2026-10-14T03:00:00Z') } // 水曜

  it('週は月曜始まり', () => {
    expect(weekStartOf('2026-10-14')).toBe('2026-10-12')
    expect(weekStartOf('2026-10-12')).toBe('2026-10-12')
    expect(weekStartOf('2026-10-18')).toBe('2026-10-12')
  })

  it('JST の日付で週に振り分ける', () => {
    const rows = weeklyTrend(
      [
        // 日曜 23:30 JST → 前の週
        { channel: 'PHONE', created_at: '2026-10-11T14:30:00Z', answer_mode: 'HUMAN' },
        // 月曜 0:30 JST（UTC では日曜）→ 今週
        { channel: 'FAX', created_at: '2026-10-11T15:30:00Z', answer_mode: null },
        { channel: 'WEB', created_at: '2026-10-13T01:00:00Z', answer_mode: 'AUTO' },
      ],
      2,
      clock,
    )
    expect(rows).toEqual([
      { weekStart: '2026-10-05', total: 1, manual: 1, manualShare: 100, auto: 0 },
      { weekStart: '2026-10-12', total: 2, manual: 1, manualShare: 50, auto: 1 },
    ])
  })
})
