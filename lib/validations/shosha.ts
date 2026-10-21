import { z } from 'zod'
import { LOGISTICS_ROUTES } from '@/lib/domain/delivery'
import { INTAKE_CHANNELS } from '@/lib/domain/labels'

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, '日付の形式が正しくありません')

const model = z
  .string()
  .trim()
  .min(1, '型番を入れてください')
  .max(100, '型番が長すぎます')

/** 電話・FAXで受けた分。入れるのは会社・商品・数量の3項目だけ（docs/25 §4）。 */
export const intakeSchema = z.object({
  tenantId: z.string().uuid('取引先を選んでください'),
  channel: z.enum(INTAKE_CHANNELS, { message: '経路を選んでください' }),
  fromCompany: z.string().trim().min(1, '会社を入れてください').max(100, '会社名が長すぎます'),
  fromPerson: z.string().trim().max(100, '担当者名が長すぎます').optional().default(''),
  productId: z.string().uuid('商品を選んでください'),
  qty: z
    .number({ message: '数量を入れてください' })
    .int('数量は整数で入れてください')
    .min(1, '数量は1以上です')
    .max(9999, '数量が大きすぎます。分けて起票してください'),
  needBy: isoDate.optional().nullable(),
  siteId: z.string().uuid().optional().nullable(),
  note: z.string().trim().max(500, 'メモが長すぎます').optional().default(''),
  idempotencyKey: z.string().min(8, '送信キーが不正です').max(100),
})

export const answerSchema = z.object({
  requestId: z.string().uuid(),
  text: z
    .string()
    .trim()
    .min(1, '回答の本文を入れてください')
    .max(2000, '回答が長すぎます'),
  route: z.enum(LOGISTICS_ROUTES, { message: '配送の形を選んでください' }),
  workDate: isoDate.optional().nullable(),
  alternatives: z.array(z.string().max(200)).max(5).optional().default([]),
})

export const aliasSchema = z.object({
  tenantId: z.string().uuid('取引先を選んでください'),
  fromModel: model,
  toModel: model,
  reason: z.string().trim().max(200, '理由が長すぎます').optional().default(''),
  requestId: z.string().uuid().optional().nullable(),
})

export const deliveryChangeSchema = z.object({
  requestId: z.string().uuid(),
  changedTo: isoDate,
  reason: z.string().trim().min(1, '理由を入れてください').max(200, '理由が長すぎます'),
})

export type IntakeInput = z.input<typeof intakeSchema>
export type AnswerInput = z.input<typeof answerSchema>
export type AliasInput = z.input<typeof aliasSchema>
export type DeliveryChangeInput = z.input<typeof deliveryChangeSchema>
