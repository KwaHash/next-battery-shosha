import { type ProductRow, type RequestItemRow } from '@/types/database'

/**
 * 相当品：欠品したときの逃げ道。
 *
 * メーカーをまたいで置き換える判断は、適合の責任が伴う。
 * **候補を出すところまで。確定は必ず人が行う。**
 * 在庫が足りているときは呼ばない（平時に出すと商流を荒らす）。
 */

type Describable = Pick<ProductRow, 'name' | 'model'>

const CLASSES: { key: string; pattern: RegExp }[] = [
  { key: 'LED_BASE_40', pattern: /40形|FHF32|ベースライト|TENQOO/i },
  { key: 'OUTLET', pattern: /コンセント/ },
  { key: 'CONDUIT', pattern: /電線管|VE-/i },
]

export function equivalenceClass(product: Describable): string | null {
  const text = `${product.name || ''} ${product.model || ''}`
  return CLASSES.find((c) => c.pattern.test(text))?.key ?? null
}

export type EquivalentCandidate = {
  product: ProductRow;
  reason: string;
}

export function findEquivalents(
  products: ProductRow[],
  item: Pick<RequestItemRow, 'name' | 'model' | 'qty'>,
): EquivalentCandidate[] {
  const key = equivalenceClass(item)
  if (!key) return []

  return products
    .filter(
      (p) =>
        p.model !== item.model
        && !p.archived_at
        && equivalenceClass(p) === key
        && p.stock >= item.qty,
    )
    .sort((a, b) => Number(b.verified) - Number(a.verified) || b.stock - a.stock)
    .map((product) => ({
      product,
      reason: product.verified
        ? '同等クラスで在庫があります'
        : '同等クラスですが適合は未確認です',
    }))
}

/** 回答に入れる代替提案の文面。器具が変わることを必ず添える。 */
export function proposalText(product: Pick<ProductRow, 'maker' | 'model' | 'stock'>): string {
  return [
    `【代替のご提案】${product.maker} ${product.model}（在庫 ${product.stock}）なら翌営業日出荷が可能です。`,
    '※ 器具寸法と配光が変わります。施主のご了解が必要です。',
  ].join('\n')
}

/** genba の回答カード「相当品の候補」に出る1行。 */
export function alternativeLabel(product: Pick<ProductRow, 'maker' | 'model'>): string {
  return `${product.maker} ${product.model}`
}
