import { z } from 'zod';

/**
 * Claude Vision이 뽑아내는 단가표 구조.
 * 모든 금액은 **원(KRW) 단위**로 변환해서 출력. (이미지의 "천원/만원" 단위 표기는 파싱 프롬프트에서 설명)
 */

const TierQuote = z.object({
  new010: z.number().nullable().describe('010 신규 단가(원). 음수 허용(페이백)'),
  mnp: z.number().nullable().describe('MNP(번호이동) 단가(원)'),
  change: z.number().nullable().describe('기변/보상/재가입 단가(원)'),
});

const ModelTier = z.object({
  plan_tier_code: z
    .string()
    .describe('내부 코드로 정규화된 요금제 구간. SKT=I_100/F_79/L_69/M_50/R_43/S_33/BASE, KT=T110/T100/T61/T37/SLIM14, LGU+=G115/G105/G95/G85/G75/G69/G61/G55/G44/G33'),
  plan_tier_raw: z.string().describe('원본 라벨 (예: "F_79 구간", "100K", "95군")'),
  subsidy_krw: z.number().nullable().describe('요금지원금/공시지원금 (원). 없으면 null'),
  common: TierQuote.nullable().describe('공통/공시 단가. KT·LGU+처럼 선약 구분 없는 거래처면 이것만'),
  select: TierQuote.nullable().describe('선약(선택약정) 단가. 제공 안 하면 null'),
});

const ParsedModel = z.object({
  model_code_raw: z.string().describe('거래처가 쓰는 원본 코드 (예: SM-S942N_512G, UIP17-256, AIP17P_256)'),
  nickname: z.string().describe('팻네임 (예: 갤럭시 S26, 아이폰17 256G)'),
  storage: z.string().nullable().describe('용량 (예: 256G, 512G, 1TB). 없으면 null'),
  retail_price_krw: z.number().describe('출고가 (원). 이미지가 천원 단위면 ×1000해서 저장'),
  is_new: z.boolean().describe('"(New)"이나 신규 표시 있으면 true'),
  tiers: z.array(ModelTier),
});

const ParsedPolicy = z.object({
  category: z.enum(['bonus_set', 'model_extra', 'combine', 'ott_addon', 'card', 'youth', 'senior', 'penalty', 'other']),
  name: z.string(),
  amount_krw: z.number().nullable(),
  conditions_text: z.string().nullable(),
});

export const SheetExtraction = z.object({
  policy_round: z.string().nullable().describe('정책 차수 (예: "4-9차", "04월 09차", "ver.15")'),
  effective_date: z.string().nullable().describe('적용 일자 YYYY-MM-DD. 연도 없으면 올해로 가정'),
  effective_time: z.string().nullable().describe('적용 시각 (예: "00시 00분", "19시 00분")'),
  models: z.array(ParsedModel),
  policies: z.array(ParsedPolicy).describe('부가정책/추가지원/결합/OTT/카드/축소 등. 본인 있는 만큼만.'),
});

export type SheetExtraction = z.infer<typeof SheetExtraction>;
export type ParsedModel = z.infer<typeof ParsedModel>;
export type ModelTier = z.infer<typeof ModelTier>;
