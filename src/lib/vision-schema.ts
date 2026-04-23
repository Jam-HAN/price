/**
 * CLOVA OCR 파서가 반환하는 단가표 구조.
 * 모든 금액은 **원(KRW) 단위**.
 */

export type TierQuote = {
  /** 010 신규 단가(원). 음수 허용(페이백) */
  new010: number | null;
  /** MNP(번호이동) 단가(원) */
  mnp: number | null;
  /** 기변/보상/재가입 단가(원) */
  change: number | null;
};

export type ModelTier = {
  /** 요금제 구간 코드. SKT=요금제붐업|I_100|F_79|L_69|M_50|R_43|S_33 등 */
  plan_tier_code: string;
  subsidy_krw: number | null;
  common: TierQuote | null;
  select: TierQuote | null;
};

export type ParsedModel = {
  /** 거래처가 쓰는 원본 코드 */
  model_code_raw: string;
  /** 팻네임 */
  nickname: string;
  /** 용량 (256G, 512G, 1TB 등). 없으면 null */
  storage: string | null;
  /** 출고가(원). 이미지에 없으면 null */
  retail_price_krw: number | null;
  /** (New) 표시 여부 */
  is_new: boolean;
  tiers: ModelTier[];
};

export type ParsedPolicy = {
  category:
    | 'bonus_set'
    | 'model_extra'
    | 'combine'
    | 'ott_addon'
    | 'card'
    | 'youth'
    | 'senior'
    | 'penalty'
    | 'other';
  name: string;
  amount_krw: number | null;
  conditions_text: string | null;
};

export type SheetExtraction = {
  /** 정책 차수 */
  policy_round: string | null;
  /** 적용 일자 YYYY-MM-DD */
  effective_date: string | null;
  /** 적용 시각 */
  effective_time: string | null;
  models: ParsedModel[];
  policies: ParsedPolicy[];
};
