import { describe, expect, it } from 'vitest'
import { toCsv } from '@/lib/domain/csv'
import { equivalenceClass, findEquivalents } from '@/lib/domain/equivalents'
import { type ProductRow } from '@/types/database'

function product(patch: Partial<ProductRow>): ProductRow {
  return {
    id: patch.model ?? 'x',
    tenant_id: 't',
    maker: 'メーカー',
    model: 'M',
    name: '',
    category: null,
    unit_price: 10000,
    stock: 0,
    lead_days: 1,
    successor_of: null,
    verified: true,
    note: null,
    created_at: '',
    updated_at: '',
    archived_at: null,
    ...patch,
  }
}

const products = [
  product({ maker: 'パナソニック', model: 'XLX450NENP LE9', name: '一体型LEDベースライト 40形', stock: 42 }),
  product({ maker: 'ホタルクス', model: 'MVDB4104/N-N8', name: 'LEDベースライト 40形', stock: 8 }),
  product({ maker: '三菱電機照明', model: 'MY-B450333/N AHTN', name: 'LEDライトユニット形ベースライト 40形', stock: 60 }),
  product({ maker: '某社', model: 'UNVERIFIED-40', name: 'ベースライト 40形', stock: 90, verified: false }),
  product({ maker: '未来工業', model: 'VE-16', name: '硬質ビニル電線管 16mm', stock: 500 }),
]

describe('相当品', () => {
  it('同じクラスで、在庫が足りるものだけ出す', () => {
    const item = { name: 'LEDベースライト 40形', model: 'MVDB4104/N-N8', qty: 20 }
    const models = findEquivalents(products, item).map((c) => c.product.model)
    expect(models).toEqual(['MY-B450333/N AHTN', 'XLX450NENP LE9', 'UNVERIFIED-40'])
  })

  it('適合確認済みを先に出し、未確認はそう書く', () => {
    const item = { name: 'LEDベースライト 40形', model: 'MVDB4104/N-N8', qty: 80 }
    const candidates = findEquivalents(products, item)
    expect(candidates).toHaveLength(1)
    expect(candidates[0].reason).toBe('同等クラスですが適合は未確認です')
  })

  it('クラスが分からない商品には出さない', () => {
    expect(equivalenceClass({ name: '漏電遮断器 30mA', model: 'GE53CA 3P30A' })).toBeNull()
    expect(findEquivalents(products, { name: '漏電遮断器 30mA', model: 'GE53CA', qty: 1 })).toEqual([])
  })
})

describe('CSV', () => {
  it('BOM付き・CRLF・引用符のエスケープ', () => {
    expect(toCsv(['a', 'b'], [['x,y', 'say "hi"'], [1, null]])).toBe(
      '﻿a,b\r\n"x,y","say ""hi"""\r\n1,\r\n',
    )
  })

  it('式として実行される値は文字にする', () => {
    expect(toCsv(['会社'], [['=HYPERLINK("http://x")'], ['-1+1'], ['@SUM(A1)']])).toBe(
      '﻿会社\r\n"\'=HYPERLINK(""http://x"")"\r\n\'-1+1\r\n\'@SUM(A1)\r\n',
    )
  })

  it('数値の負数はそのまま', () => {
    expect(toCsv(['n'], [[-5]])).toBe('﻿n\r\n-5\r\n')
  })
})
