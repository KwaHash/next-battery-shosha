import { describe, expect, it } from 'vitest'
import {
  type AnswerableItem,
  AUTO_MAX_AMOUNT,
  AUTO_MAX_QTY,
  canAutoAnswer,
  draftAnswer,
  isSafetyItem,
} from '@/lib/domain/auto-answer'

const led: AnswerableItem = {
  name: '一体型LEDベースライト 40形 5200lm 昼白色',
  model: 'XLX450NENP LE9',
  category: null,
  qty: 20,
  stock: 42,
  unit_price: 12800,
  lead_days: 1,
  verified: true,
}

const elcb: AnswerableItem = {
  name: '漏電遮断器 30mA',
  model: 'GE53CA 3P30A',
  category: '保安',
  qty: 6,
  stock: 25,
  unit_price: 9800,
  lead_days: 2,
  verified: true,
}

describe('canAutoAnswer（5条件）', () => {
  it('5条件を全部満たせば自動で返せる', () => {
    const verdict = canAutoAnswer(led, { answeredBefore: true })
    expect(verdict.ok).toBe(true)
    expect(verdict.blockers).toEqual([])
    expect(verdict.reasons).toHaveLength(5)
  })

  it('初回は人が確認する（人が承認した履歴がない）', () => {
    const verdict = canAutoAnswer(led, { answeredBefore: false })
    expect(verdict.ok).toBe(false)
    expect(verdict.blockers).toEqual(['この型番の回答履歴がありません（初回は人が確認します）'])
  })

  it('A-8 保安機器は履歴があっても自動回答されない', () => {
    const verdict = canAutoAnswer(elcb, { answeredBefore: true })
    expect(verdict.ok).toBe(false)
    expect(verdict.blockers[0]).toBe('保安に関わる機器です。必ず人が確認します')
  })

  it.each([
    ['名前', { name: 'ノーヒューズブレーカ 2P' }],
    ['型番', { model: 'NV63-CV ELCB' }],
    ['分類', { category: '保護継電器' }],
  ])('保安機器は%sからも見つける', (_, patch) => {
    expect(isSafetyItem({ ...led, ...patch })).toBe(true)
  })

  it('在庫が足りなければ人へ', () => {
    const verdict = canAutoAnswer({ ...led, stock: 19 }, { answeredBefore: true })
    expect(verdict.blockers).toEqual(['在庫が不足しています。納期の判断が要ります'])
  })

  it('数量の上限ちょうどは自動、超えたら人へ', () => {
    const cheap = { ...led, unit_price: 100, stock: 999 }
    expect(canAutoAnswer({ ...cheap, qty: AUTO_MAX_QTY }, { answeredBefore: true }).ok).toBe(true)
    expect(canAutoAnswer({ ...cheap, qty: AUTO_MAX_QTY + 1 }, { answeredBefore: true }).ok).toBe(false)
  })

  it('金額の上限ちょうどは自動、超えたら人へ', () => {
    const base = { ...led, qty: 10, stock: 999 }
    const atLimit = { ...base, unit_price: AUTO_MAX_AMOUNT / 10 }
    const over = { ...base, unit_price: AUTO_MAX_AMOUNT / 10 + 1 }
    expect(canAutoAnswer(atLimit, { answeredBefore: true }).ok).toBe(true)
    expect(canAutoAnswer(over, { answeredBefore: true }).blockers).toEqual([
      '大口のため人が確認します（10個／300,010円）',
    ])
  })

  it('適合が未確認なら人へ', () => {
    const verdict = canAutoAnswer({ ...led, verified: false }, { answeredBefore: true })
    expect(verdict.blockers).toEqual(['適合が未確認の商品です'])
  })

  it('欠けた条件はすべて理由として出す', () => {
    const verdict = canAutoAnswer(
      { ...elcb, stock: 0, verified: false },
      { answeredBefore: false },
    )
    expect(verdict.blockers).toHaveLength(4)
  })
})

describe('draftAnswer', () => {
  it('在庫で足りるとき', () => {
    expect(draftAnswer(led, { answeredBefore: true })).toBe(
      '在庫あります。本日15時までのご注文で翌営業日着です。\n単価 12,800円（税別）。',
    )
  })

  it('一部だけ在庫があるとき、分納を案内する', () => {
    expect(draftAnswer({ ...led, stock: 8, lead_days: 4 }, { answeredBefore: false })).toContain(
      '在庫が8個です。不足分は4営業日で入荷します。分納も可能です。',
    )
  })

  it('在庫切れのとき', () => {
    expect(draftAnswer({ ...led, stock: 0, lead_days: 5 }, { answeredBefore: false })).toContain(
      '在庫切れです。5営業日で入荷予定です。',
    )
  })

  it('後継品として登録があれば添える', () => {
    const text = draftAnswer(led, {
      answeredBefore: false,
      aliases: [{ from_model: 'FSA41029', to_model: 'XLX450NENP LE9' }],
    })
    expect(text).toContain('※ FSA41029 の後継品です。')
  })

  it('適合が未確認なら注意書きを付ける', () => {
    expect(draftAnswer({ ...led, verified: false }, { answeredBefore: false })).toContain(
      '※ 適合は未確認です。取付寸法をご確認ください。',
    )
  })
})
