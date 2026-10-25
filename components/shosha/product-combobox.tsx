'use client'

import { useMemo, useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { yen } from '@/lib/domain/clock'
import { cn } from '@/lib/utils'
import { type ModelAliasRow, type ProductRow } from '@/types/database'

/**
 * 商品を型番・品名・メーカーで探す。
 * 電話で言われた旧型番（廃番）でも、後継品の登録があれば当たる。
 */
export function ProductCombobox({
  id,
  products,
  aliases,
  value,
  onChange,
}: {
  id?: string;
  products: ProductRow[];
  aliases: ModelAliasRow[];
  value: string;
  onChange: (productId: string) => void;
}) {
  const [open, setOpen] = useState(false)
  const selected = products.find((p) => p.id === value)

  const keywords = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const alias of aliases) {
      const key = `${alias.tenant_id}\u0000${alias.to_model}`
      map.set(key, [...(map.get(key) ?? []), alias.from_model])
    }
    return map
  }, [aliases])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('h-auto min-h-10 w-full justify-between px-3 py-2 text-left font-normal', !selected && 'text-muted-foreground')}
        >
          {selected ? (
            <span className="min-w-0">
              <span className="block truncate font-semibold">
                {selected.maker} {selected.model}
              </span>
              <span className="block truncate text-xs text-muted-foreground">{selected.name}</span>
            </span>
          ) : (
            '型番・品名で探す'
          )}
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[320px] p-0" align="start">
        <Command>
          <CommandInput placeholder="型番・品名・メーカー・旧型番" />
          <CommandList>
            <CommandEmpty>見つかりません。商品マスタに無い型番は、担当者へ回してください。</CommandEmpty>
            <CommandGroup>
              {products.map((product) => {
                const old = [
                  ...(keywords.get(`${product.tenant_id}\u0000${product.model}`) ?? []),
                  ...(product.successor_of ? [product.successor_of] : []),
                ]
                return (
                  <CommandItem
                    key={product.id}
                    value={product.id}
                    keywords={[product.maker, product.model, product.name, ...old]}
                    onSelect={() => {
                      onChange(product.id)
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn('size-4 shrink-0', value === product.id ? 'opacity-100' : 'opacity-0')}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">
                        {product.maker} {product.model}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {product.name}
                        {old.length ? `（旧 ${old.join('・')}）` : ''}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                      在庫 {product.stock}
                      <br />
                      {yen(product.unit_price)}
                    </span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
