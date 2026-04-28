/**
 * CLOVA OCR 실패 셀 자동 보강: row 단위 Vision LLM fallback.
 *
 * 배경: CLOVA의 표 인식이 워치 row 같이 반복 값("1 1 1...")이 많으면 인접 셀을 병합하고,
 * 일반 row에서도 ~10% 셀이 빈 값으로 인식됨. 자동화 목표상 사람 검수 없이 채워야 한다.
 *
 * 전략:
 *  1) parser 결과에서 "의심 모델" 자동 감지 (워치, tier 부족, common null 비율 50%+)
 *  2) CLOVA cells의 boundingPoly로 해당 row의 픽셀 좌표 (yMin, yMax) 추출
 *  3) region 이미지에서 그 row만 잘라 Claude Sonnet vision API에 보냄
 *  4) JSON 응답을 ModelTier[]로 변환 → 기존 model.tiers 교체
 *
 * 제약:
 *  - SKT 청담/피에스 부터 적용 (다른 vendor는 추가 시 VENDOR_CONFIGS 확장)
 *  - ANTHROPIC_API_KEY 환경변수 필요
 *  - 의심 row가 없으면 zero overhead
 */

import type { ClovaImage } from './clova-ocr';
import type { SheetExtraction, ParsedModel, ModelTier, TierQuote } from './vision-schema';

type RawCell = {
  rowIndex: number;
  columnIndex: number;
  boundingPoly?: { vertices?: Array<{ x: number; y: number }> };
  cellTextLines?: Array<{
    cellWords?: Array<{
      inferText?: string;
      boundingPoly?: { vertices?: Array<{ x: number; y: number }> };
    }>;
  }>;
};

type CellBounds = {
  rowIndex: number;
  columnIndex: number;
  text: string;
  yMin: number;
  yMax: number;
  xMin: number;
  xMax: number;
};

function extractCellsWithBounds(img: ClovaImage): CellBounds[] {
  const tables = (img as unknown as { tables?: Array<{ cells: RawCell[] }> }).tables;
  if (!tables || !tables[0]) return [];
  const out: CellBounds[] = [];
  for (const c of tables[0].cells) {
    const xs: number[] = [];
    const ys: number[] = [];
    for (const v of c.boundingPoly?.vertices ?? []) {
      xs.push(v.x);
      ys.push(v.y);
    }
    const parts: string[] = [];
    for (const line of c.cellTextLines ?? []) {
      for (const w of line.cellWords ?? []) {
        if (w.inferText) parts.push(w.inferText);
        for (const v of w.boundingPoly?.vertices ?? []) {
          xs.push(v.x);
          ys.push(v.y);
        }
      }
    }
    if (xs.length === 0 || ys.length === 0) continue;
    out.push({
      rowIndex: c.rowIndex,
      columnIndex: c.columnIndex,
      text: parts.join(' ').trim(),
      yMin: Math.min(...ys),
      yMax: Math.max(...ys),
      xMin: Math.min(...xs),
      xMax: Math.max(...xs),
    });
  }
  return out;
}

type VendorConfig = {
  tierCodes: string[];
  /** 공시지원금 단위. 청담은 만원, 피에스는 천원 */
  subsidyUnit: 'man' | 'chun';
  /** 선약(select) 컬럼 존재 여부. SKT=true, LGU/KT=false */
  hasSelect: boolean;
  /** 단가표 행 추출 시 LLM에게 줄 컨텍스트 라벨 */
  carrierLabel: string;
};

const VENDOR_CONFIGS: Record<string, VendorConfig> = {
  'skt-cd': {
    tierCodes: ['요금제붐업', 'I_100', 'F_79', 'L_69', 'M_50', 'R_43', 'S_33'],
    subsidyUnit: 'man',
    hasSelect: true,
    carrierLabel: 'SKT 청담',
  },
  'skt-ps': {
    tierCodes: ['요금제붐업', 'I_100', 'F_79', 'L_69', 'M_50', 'R_43', 'S_33'],
    subsidyUnit: 'chun',
    hasSelect: true,
    carrierLabel: 'SKT 피에스',
  },
  'lgu-daesan': {
    tierCodes: ['G115', 'G105', 'G95', 'G85', 'G69', 'G55', 'G33'],
    subsidyUnit: 'man',
    hasSelect: false,
    carrierLabel: 'LGU+ 대산',
  },
  'lgu-anseong': {
    tierCodes: ['G115', 'G105', 'G85', 'G69', 'G55', 'G33'],
    subsidyUnit: 'man',
    hasSelect: false,
    carrierLabel: 'LGU+ 안성',
  },
  'kt-near': {
    tierCodes: ['T110', 'T100', 'T61', 'T37'],
    subsidyUnit: 'chun',
    hasSelect: false,
    carrierLabel: 'KT 니어',
  },
};

function isWatch(modelCode: string): boolean {
  return /^SM-L\d/.test(modelCode);
}

/**
 * subsidy 단조성 위배 감지 (OCR cell 매핑 오류 의심).
 *
 * 정상 패턴: 상위 tier(요금제붐업/I_100) subsidy가 가장 높고 하위로 갈수록 감소.
 * 이상 케이스: 첫 tier subsidy가 중앙값의 절반 미만 → 다른 컬럼 값이 잘못 매핑됨.
 *
 * 예: SM-F741N_512G [100, 100, 580, 523, 430, 380, 289] → median=430, first=100 → 위배.
 *     LLM fallback으로 재추출 필요.
 */
function isSubsidyMonotonicityViolated(model: ParsedModel): boolean {
  const subsidies = model.tiers
    .map((t) => t.subsidy_krw)
    .filter((v): v is number => v != null && v > 0);
  if (subsidies.length < 4) return false;
  const sorted = [...subsidies].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  if (median < 50_000) return false; // subsidy가 전반적으로 낮은 모델은 단조성 의미 없음
  const first = subsidies[0];
  return first < median * 0.5;
}

/**
 * 머지된 워치 row의 subsidy를 OCR/LLM 정상값(5만원+) 최빈값으로 최종 통일.
 * correctWatchSubsidyHallucination이 LLM 단계에서 놓친 케이스 보호용.
 */
function unifyWatchSubsidies(modelCode: string, tiers: ModelTier[]): ModelTier[] {
  if (!isWatch(modelCode)) return tiers;
  const validSubsidies = tiers
    .map((t) => t.subsidy_krw)
    .filter((v): v is number => v != null && v >= 50_000);
  if (validSubsidies.length < 2) return tiers;
  const counts = new Map<number, number>();
  for (const v of validSubsidies) counts.set(v, (counts.get(v) ?? 0) + 1);
  let mode = validSubsidies[0];
  let modeCount = 0;
  for (const [v, c] of counts) {
    if (c > modeCount) {
      mode = v;
      modeCount = c;
    }
  }
  return tiers.map((t) => ({ ...t, subsidy_krw: mode }));
}

function isSuspicious(model: ParsedModel, expectedTierCount: number): { suspicious: boolean; reason?: string } {
  // 워치는 OCR 셀 병합 빈발 → 항상 보강
  if (isWatch(model.model_code_raw)) return { suspicious: true, reason: 'watch' };
  // tier 누락 (7개 중 5개 미만)
  if (model.tiers.length < Math.floor(expectedTierCount * 0.7)) {
    return { suspicious: true, reason: `tiers=${model.tiers.length}` };
  }
  // 선약 column 보유 vendor 자동 감지 (모든 tier select=null이면 LGU/KT 같은 vendor → select 체크 skip)
  const hasSelectColumn = model.tiers.some((t) => t.select != null);
  // tier 단위 통째 null (common 또는 select가 한 tier에서 통째로 null) → 1개라도 즉시 트리거
  let commonAllNullTiers = 0;
  let selectAllNullTiers = 0;
  let commonNullCells = 0;
  let selectNullCells = 0;
  for (const t of model.tiers) {
    if (!t.common) commonAllNullTiers++;
    else {
      if (t.common.new010 == null) commonNullCells++;
      if (t.common.mnp == null) commonNullCells++;
      if (t.common.change == null) commonNullCells++;
    }
    if (hasSelectColumn) {
      if (!t.select) selectAllNullTiers++;
      else {
        if (t.select.new010 == null) selectNullCells++;
        if (t.select.mnp == null) selectNullCells++;
        if (t.select.change == null) selectNullCells++;
      }
    }
  }
  if (commonAllNullTiers >= 1) {
    return { suspicious: true, reason: `common 통째 null tier ${commonAllNullTiers}개` };
  }
  if (hasSelectColumn && selectAllNullTiers >= 1) {
    return { suspicious: true, reason: `select 통째 null tier ${selectAllNullTiers}개` };
  }
  // 산발 null도 2개 이상이면 트리거 (common/select 합산, hasSelect=false면 common만)
  const totalNullCells = commonNullCells + (hasSelectColumn ? selectNullCells : 0);
  if (totalNullCells >= 2) {
    return { suspicious: true, reason: `null cells ${totalNullCells}개` };
  }
  // subsidy 단조성 위배 (OCR cell 매핑 오류 의심)
  if (isSubsidyMonotonicityViolated(model)) {
    return { suspicious: true, reason: 'subsidy 단조성 위배' };
  }
  return { suspicious: false };
}

/**
 * LLM 결과와 원본 OCR 결과를 cell 단위로 머지.
 *
 * 정책:
 *  - LLM이 null이면 OCR 값 유지 (LLM이 못 읽었어도 OCR이 본 값 보존)
 *  - LLM 값 + OCR null → LLM 값 사용 (LLM이 채운 cell)
 *  - 둘 다 값 있으면 LLM 우선. 단 10배 이상 차이는 LLM 환각으로 간주 → OCR 유지
 *
 * 효과: LLM은 enhancer로만 동작. OCR이 잘 잡은 cell은 절대 잃지 않음.
 */
function mergeLlmIntoOcr(ocrTiers: ModelTier[], llmTiers: ModelTier[]): ModelTier[] {
  const ocrByPlan = new Map(ocrTiers.map((t) => [t.plan_tier_code, t]));
  const result: ModelTier[] = [];

  const mergeCell = (l: number | null, o: number | null): number | null => {
    if (l == null) return o;
    if (o == null) return l;
    // 10배 이상 차이는 LLM 환각으로 간주
    const lo = Math.min(l, o);
    const hi = Math.max(l, o);
    if (lo > 0 && hi >= lo * 10) return o;
    return l;
  };

  const mergeQuote = (l: TierQuote | null, o: TierQuote | null): TierQuote | null => {
    if (l == null && o == null) return null;
    if (l == null) return o;
    if (o == null) return l;
    return {
      new010: mergeCell(l.new010, o.new010),
      mnp: mergeCell(l.mnp, o.mnp),
      change: mergeCell(l.change, o.change),
    };
  };

  for (const llm of llmTiers) {
    const ocr = ocrByPlan.get(llm.plan_tier_code);
    if (!ocr) {
      result.push(llm);
      continue;
    }
    result.push({
      plan_tier_code: llm.plan_tier_code,
      subsidy_krw: mergeCell(llm.subsidy_krw, ocr.subsidy_krw),
      common: mergeQuote(llm.common, ocr.common),
      select: mergeQuote(llm.select, ocr.select),
    });
  }

  // OCR에만 있는 tier도 보존
  const llmPlans = new Set(llmTiers.map((t) => t.plan_tier_code));
  for (const ocr of ocrTiers) {
    if (!llmPlans.has(ocr.plan_tier_code)) result.push(ocr);
  }

  return result;
}

/**
 * 워치 subsidy 교호 환각 보정.
 * SM-L705NB 케이스: LLM이 "tier마다 subsidy 다름" 추론 → 300/150/300/150 패턴 환각.
 * 실제 워치는 모든 tier subsidy 동일.
 *
 * 휴리스틱: 워치 row이고 common/select가 모든 tier에서 동일하면
 * subsidy 7개 중 최빈값으로 통일.
 */
function correctWatchSubsidyHallucination(modelCode: string, tiers: ModelTier[]): ModelTier[] {
  if (!isWatch(modelCode)) return tiers;
  if (tiers.length < 5) return tiers;
  // 모든 tier의 common, select가 동일한지
  const stringify = (q: { new010: number | null; mnp: number | null; change: number | null } | null): string =>
    q ? `${q.new010}|${q.mnp}|${q.change}` : 'null';
  const firstCommon = stringify(tiers[0].common);
  const firstSelect = stringify(tiers[0].select);
  const allSame = tiers.every(
    (t) => stringify(t.common) === firstCommon && stringify(t.select) === firstSelect,
  );
  if (!allSame) return tiers;
  // subsidy 최빈값. 5만원 미만 (50000) 값은 LLM 환각으로 간주하고 제외.
  // (워치 subsidy는 일반적으로 5만원 이상 — 이전 환각 사례: 0.1만원=1000원)
  const subsidies = tiers.map((t) => t.subsidy_krw).filter((v): v is number => v != null);
  const validSubsidies = subsidies.filter((v) => v >= 50_000);
  if (validSubsidies.length < 2) return tiers;
  const counts = new Map<number, number>();
  for (const v of validSubsidies) counts.set(v, (counts.get(v) ?? 0) + 1);
  let mode = validSubsidies[0];
  let modeCount = 0;
  for (const [v, c] of counts) {
    if (c > modeCount) {
      mode = v;
      modeCount = c;
    }
  }
  // 유효 subsidy의 최빈값으로 모든 tier 통일 (워치는 모든 tier subsidy 동일이라는 도메인 지식)
  return tiers.map((t) => ({ ...t, subsidy_krw: mode }));
}

async function cropRowImage(regionBytes: Buffer, yMin: number, yMax: number, padding = 6): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  const meta = await sharp(regionBytes).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (!w || !h) throw new Error('region image metadata missing');
  const top = Math.max(0, Math.floor(yMin) - padding);
  const bottom = Math.min(h, Math.ceil(yMax) + padding);
  const cropH = Math.max(1, bottom - top);
  return await sharp(regionBytes)
    .extract({ left: 0, top, width: w, height: cropH })
    .png()
    .toBuffer();
}

type LlmTier = {
  plan: string;
  subsidy: number | null;
  common: [number | null, number | null, number | null];
  select: [number | null, number | null, number | null];
};

async function callClaudeVision(imageBytes: Buffer, prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY 환경변수 누락');
  const imageBase64 = imageBytes.toString('base64');

  // 429 / 5xx 재시도 with exponential backoff (1s → 2s → 4s, 최대 3회)
  const maxAttempts = 3;
  let lastErr: string | null = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: imageBase64 } },
              { type: 'text', text: prompt },
            ],
          },
        ],
      }),
    });
    if (res.ok) {
      const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
      const text = json.content?.find((c) => c.type === 'text')?.text ?? '';
      if (!text) throw new Error('Anthropic 응답에 text 없음');
      return text;
    }
    const errText = await res.text();
    lastErr = `Anthropic ${res.status}: ${errText.slice(0, 300)}`;
    // 429(rate limit), 529(overloaded), 5xx 재시도. 4xx 다른 에러는 즉시 throw.
    const retryable = res.status === 429 || res.status === 529 || res.status >= 500;
    if (!retryable || attempt === maxAttempts - 1) {
      throw new Error(lastErr);
    }
    const backoffMs = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s
    await new Promise((resolve) => setTimeout(resolve, backoffMs));
  }
  throw new Error(lastErr ?? 'Anthropic 호출 실패');
}

function parseLlmJson(text: string): LlmTier[] | null {
  // ```json 코드블록 또는 첫 번째 { ... } 매치
  const blockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  const raw = blockMatch ? blockMatch[1] : (text.match(/\{[\s\S]*\}/)?.[0] ?? '');
  if (!raw) return null;
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== 'object') return null;
  const tiers = (obj as { tiers?: unknown }).tiers;
  if (!Array.isArray(tiers)) return null;
  const out: LlmTier[] = [];
  for (const t of tiers) {
    if (!t || typeof t !== 'object') continue;
    const o = t as Record<string, unknown>;
    if (typeof o.plan !== 'string') continue;
    const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    const trio = (arr: unknown): [number | null, number | null, number | null] => {
      if (!Array.isArray(arr) || arr.length < 3) return [null, null, null];
      return [num(arr[0]), num(arr[1]), num(arr[2])];
    };
    out.push({
      plan: o.plan,
      subsidy: num(o.subsidy),
      common: trio(o.common),
      select: trio(o.select),
    });
  }
  return out;
}

function llmTiersToModelTiers(llmTiers: LlmTier[], config: VendorConfig): ModelTier[] {
  const tiers: ModelTier[] = [];
  for (const t of llmTiers) {
    const planTier = config.tierCodes.includes(t.plan) ? t.plan : t.plan;
    const subsidyKrw =
      t.subsidy != null
        ? Math.round(t.subsidy * (config.subsidyUnit === 'chun' ? 1_000 : 10_000))
        : null;
    const trioToQuote = (arr: [number | null, number | null, number | null]): TierQuote | null => {
      if (arr.every((v) => v == null)) return null;
      return {
        new010: arr[0] != null ? Math.round(arr[0] * 10_000) : null,
        mnp: arr[1] != null ? Math.round(arr[1] * 10_000) : null,
        change: arr[2] != null ? Math.round(arr[2] * 10_000) : null,
      };
    };
    const common = trioToQuote(t.common);
    const select = config.hasSelect ? trioToQuote(t.select) : null;
    if (subsidyKrw == null && common == null && select == null) continue;
    tiers.push({
      plan_tier_code: planTier,
      subsidy_krw: subsidyKrw,
      common,
      select,
    });
  }
  return tiers;
}

function buildPrompt(modelCode: string, nickname: string, config: VendorConfig): string {
  const subsidyDesc =
    config.subsidyUnit === 'chun'
      ? '천원 단위 (예: "500" = 500,000원, "350" = 350,000원)'
      : '만원 단위 (예: "50" = 500,000원)';
  const tierList = config.tierCodes.join(', ');

  if (config.hasSelect) {
    // SKT: 7개 셀 [공시 + 공통3 + 선약3]
    const exampleTier = `{"plan": "${config.tierCodes[0]}", "subsidy": <number|null>, "common": [<010|null>, <MNP|null>, <기변|null>], "select": [<010|null>, <MNP|null>, <기변|null>]}`;
    return `이 이미지는 ${config.carrierLabel} 단가표의 한 행(row)이다.
모델: ${modelCode}${nickname ? ` (${nickname})` : ''}

이 행에 ${config.tierCodes.length}개 요금제 구간이 왼쪽→오른쪽 순서로 배치되어 있다.
구간 순서: ${tierList}

각 구간은 7개 셀 [공시지원금, 공통_010, 공통_MNP, 공통_기변, 선약_010, 선약_MNP, 선약_기변]:
- 공시지원금: ${subsidyDesc}
- 공통/선약 6개: 만원 단위 (예: "50" = 500,000원, "1" = 10,000원, "0.5" = 5,000원)

중요:
1) 빈 셀, "-", "·", "0"은 모두 null로 처리
2) 숫자는 이미지에 보이는 그대로 입력 (단위 변환 금지, "33.3"은 33.3 그대로)
3) 셀 간 구분이 모호하면 추측 말고 null
4) 추가 설명/마크다운 없이 JSON 객체만 출력

응답 형식:
{
  "tiers": [
    ${exampleTier},
    ... (총 ${config.tierCodes.length}개)
  ]
}`;
  }

  // LGU/KT: 약정 구분 없는 단일 단가 — [공시 + 010/MNP/기변]
  const exampleTier = `{"plan": "${config.tierCodes[0]}", "subsidy": <number|null>, "common": [<010|null>, <MNP|null>, <기변|null>]}`;
  return `이 이미지는 ${config.carrierLabel} 단가표의 한 행(row)이다.
모델: ${modelCode}${nickname ? ` (${nickname})` : ''}

이 행에 ${config.tierCodes.length}개 요금제 구간이 왼쪽→오른쪽 순서로 배치되어 있다.
구간 순서: ${tierList}

각 구간은 [공시지원금, 010 신규, MNP, 기변] 4개 cell이다.
이 vendor는 **공통지원금 / 선택약정 구분 없음** — 약정 무관 단일 단가 1세트만 존재.

- 공시지원금: ${subsidyDesc} (이미지에 공시 컬럼이 없으면 null)
- 010/MNP/기변: 약정 무관 단가 (만원 단위)

중요:
1) 빈 셀, "-", "·", "0"은 모두 null로 처리
2) 숫자는 이미지에 보이는 그대로 (단위 변환 금지)
3) 셀 간 구분 모호하면 추측 말고 null
4) 추가 설명/마크다운 없이 JSON 객체만 출력
5) JSON의 common 키에 단가 3개 입력, select는 출력하지 말 것

응답 형식:
{
  "tiers": [
    ${exampleTier},
    ... (총 ${config.tierCodes.length}개)
  ]
}`;
}

export type FallbackDebug = {
  model: string;
  status: 'replaced' | 'failed' | 'skipped' | 'no-row';
  reason?: string;
  oldTierCount?: number;
  newTierCount?: number;
};

export type FallbackResult = {
  parsed: SheetExtraction;
  fallbackCount: number;
  fallbackErrors: number;
  debug: FallbackDebug[];
};

export async function applyVisionFallback(params: {
  regionBytes: Buffer;
  clovaImg: ClovaImage;
  parsed: SheetExtraction;
  parserKey: string | null | undefined;
}): Promise<FallbackResult> {
  const config = params.parserKey ? VENDOR_CONFIGS[params.parserKey] : undefined;
  if (!config) {
    return { parsed: params.parsed, fallbackCount: 0, fallbackErrors: 0, debug: [] };
  }
  const cells = extractCellsWithBounds(params.clovaImg);
  if (cells.length === 0) {
    return { parsed: params.parsed, fallbackCount: 0, fallbackErrors: 0, debug: [] };
  }

  const modelCodeRegex = /^(SM-|UIP|UAW|AT-|IP[A\d]|AIP)/;
  const modelToRow = new Map<string, number>();
  for (const c of cells) {
    const tokens = c.text.split(/\s+/);
    let firstSeen: string | null = null;
    for (const t of tokens) {
      if (modelCodeRegex.test(t)) {
        if (firstSeen == null) firstSeen = t;
        if (!modelToRow.has(t)) {
          // 합쳐진 셀("SM-L325N SM-L335N") 두 번째 토큰은 다음 row로 가정
          const offset = firstSeen === t ? 0 : tokens.indexOf(t);
          modelToRow.set(t, c.rowIndex + offset);
        }
      }
    }
  }

  // suspicious 모델 큐
  type Job = { idx: number; model: ParsedModel; rowIdx: number };
  const jobs: Job[] = [];
  const debug: FallbackDebug[] = [];
  const updatedModels: ParsedModel[] = [...params.parsed.models];

  for (let i = 0; i < params.parsed.models.length; i++) {
    const m = params.parsed.models[i];
    const sus = isSuspicious(m, config.tierCodes.length);
    if (!sus.suspicious) {
      debug.push({ model: m.model_code_raw, status: 'skipped' });
      continue;
    }
    const rowIdx = modelToRow.get(m.model_code_raw);
    if (rowIdx == null) {
      debug.push({ model: m.model_code_raw, status: 'no-row', reason: sus.reason });
      continue;
    }
    jobs.push({ idx: i, model: m, rowIdx });
  }

  if (jobs.length === 0) {
    return { parsed: params.parsed, fallbackCount: 0, fallbackErrors: 0, debug };
  }

  const sharp = (await import('sharp')).default;
  const meta = await sharp(params.regionBytes).metadata();
  const imgH = meta.height ?? 0;

  let fallbackCount = 0;
  let fallbackErrors = 0;
  const concurrency = 2; // Anthropic rate limit 보수적 운영 (3 → 2)

  type JobOk = { job: Job; ok: true; newTiers: ModelTier[] };
  type JobFail = { job: Job; ok: false; reason: string };
  type JobResult = JobOk | JobFail;

  for (let i = 0; i < jobs.length; i += concurrency) {
    const batch = jobs.slice(i, i + concurrency);
    const settled = await Promise.allSettled(
      batch.map(async (job): Promise<JobResult> => {
        const rowCells = cells.filter((c) => c.rowIndex === job.rowIdx);
        if (rowCells.length === 0) return { job, ok: false, reason: 'no row cells' };
        const yMin = Math.min(...rowCells.map((c) => c.yMin));
        const yMax = Math.max(...rowCells.map((c) => c.yMax));
        if (yMax <= yMin || yMax - yMin > imgH) return { job, ok: false, reason: 'bad bounds' };
        const rowImg = await cropRowImage(params.regionBytes, yMin, yMax);
        const prompt = buildPrompt(job.model.model_code_raw, job.model.nickname, config);
        const text = await callClaudeVision(rowImg, prompt);
        const llmTiers = parseLlmJson(text);
        if (!llmTiers || llmTiers.length === 0) {
          return { job, ok: false, reason: 'LLM JSON parse failed' };
        }
        const rawLlmTiers = llmTiersToModelTiers(llmTiers, config);
        if (rawLlmTiers.length === 0) {
          return { job, ok: false, reason: 'all tiers empty after parse' };
        }
        const correctedLlmTiers = correctWatchSubsidyHallucination(job.model.model_code_raw, rawLlmTiers);
        // LLM 결과를 OCR 결과에 cell 단위로 머지 (LLM null → OCR 유지, 10x 차이 → OCR 유지)
        const mergedTiers = mergeLlmIntoOcr(job.model.tiers, correctedLlmTiers);
        // 워치는 머지 후에도 subsidy 정상값 기반 통일 (이중 보호)
        const newTiers = unifyWatchSubsidies(job.model.model_code_raw, mergedTiers);
        return { job, ok: true, newTiers };
      }),
    );
    for (const r of settled) {
      if (r.status === 'rejected') {
        fallbackErrors++;
        debug.push({ model: 'unknown', status: 'failed', reason: String(r.reason).slice(0, 100) });
        continue;
      }
      const v = r.value;
      if (!v.ok) {
        fallbackErrors++;
        debug.push({ model: v.job.model.model_code_raw, status: 'failed', reason: v.reason });
        continue;
      }
      updatedModels[v.job.idx] = { ...v.job.model, tiers: v.newTiers };
      fallbackCount++;
      debug.push({
        model: v.job.model.model_code_raw,
        status: 'replaced',
        oldTierCount: v.job.model.tiers.length,
        newTierCount: v.newTiers.length,
      });
    }
  }

  return {
    parsed: { ...params.parsed, models: updatedModels },
    fallbackCount,
    fallbackErrors,
    debug,
  };
}

export function fallbackVendorSupported(parserKey: string | null | undefined): boolean {
  return !!parserKey && parserKey in VENDOR_CONFIGS;
}
