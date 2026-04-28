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
};

function isWatch(modelCode: string): boolean {
  return /^SM-L\d/.test(modelCode);
}

function isSuspicious(model: ParsedModel, expectedTierCount: number): { suspicious: boolean; reason?: string } {
  // 워치는 OCR 셀 병합 빈발 → 항상 보강
  if (isWatch(model.model_code_raw)) return { suspicious: true, reason: 'watch' };
  // tier 누락 (7개 중 5개 미만)
  if (model.tiers.length < Math.floor(expectedTierCount * 0.7)) {
    return { suspicious: true, reason: `tiers=${model.tiers.length}` };
  }
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
    if (!t.select) selectAllNullTiers++;
    else {
      if (t.select.new010 == null) selectNullCells++;
      if (t.select.mnp == null) selectNullCells++;
      if (t.select.change == null) selectNullCells++;
    }
  }
  if (commonAllNullTiers >= 1) {
    return { suspicious: true, reason: `common 통째 null tier ${commonAllNullTiers}개` };
  }
  if (selectAllNullTiers >= 1) {
    return { suspicious: true, reason: `select 통째 null tier ${selectAllNullTiers}개` };
  }
  // 산발 null도 2개 이상이면 트리거 (common/select 합산)
  const totalNullCells = commonNullCells + selectNullCells;
  if (totalNullCells >= 2) {
    return { suspicious: true, reason: `null cells ${totalNullCells}개` };
  }
  return { suspicious: false };
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
  // subsidy 최빈값
  const subsidies = tiers.map((t) => t.subsidy_krw).filter((v): v is number => v != null);
  if (subsidies.length < 5) return tiers;
  const counts = new Map<number, number>();
  for (const v of subsidies) counts.set(v, (counts.get(v) ?? 0) + 1);
  let mode = subsidies[0];
  let modeCount = 0;
  for (const [v, c] of counts) {
    if (c > modeCount) {
      mode = v;
      modeCount = c;
    }
  }
  // 최빈값이 과반이 아니면 보정 안 함 (애매한 경우 LLM 판단 유지)
  if (modeCount * 2 <= subsidies.length) return tiers;
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
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Anthropic ${res.status}: ${t.slice(0, 300)}`);
  }
  const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = json.content?.find((c) => c.type === 'text')?.text ?? '';
  if (!text) throw new Error('Anthropic 응답에 text 없음');
  return text;
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
  const concurrency = 3;

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
        const rawNewTiers = llmTiersToModelTiers(llmTiers, config);
        if (rawNewTiers.length === 0) {
          return { job, ok: false, reason: 'all tiers empty after parse' };
        }
        const newTiers = correctWatchSubsidyHallucination(job.model.model_code_raw, rawNewTiers);
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
