import { visionExtract, VISION_MODEL_PRIMARY, VISION_MODEL_REPARSE, VISION_MODEL_CLAUDE, VISION_MODEL_GEMINI, VISION_MODEL_GPT5 } from './ai';
import { SheetExtraction, type ParsedModel } from './vision-schema';
import { PROMPTS } from './vision-prompts';
import { z } from 'zod';

export type Carrier = 'SKT' | 'KT' | 'LGU+';

const ANTI_COPY_RULE = `
==============================
⚠️ 매우 중요 — 복사 금지 규칙
==============================
- 각 (구간, 개통유형) 조합은 반드시 이미지에서 **독립적으로** 읽을 것
- 인접 구간(예: BASE → I_100)의 값을 그대로 복사해 붙이지 말 것
- 같은 값이 3개 이상 구간에서 연속 동일하게 나타나면 **잘못 읽은 것**일 수 있음 → 해당 셀들 null로 표시
- 읽기 어려운 숫자는 **null이 잘못된 값보다 안전**. 추측 금지
- 특히 저가 구간(M_50, R_43, S_33 또는 T37, G33)에서 값이 거의 같아 보여도 **미세한 차이**가 있으므로 각각 확인
`;

export async function parseSheetImage(params: {
  imageBytes: Uint8Array | Buffer;
  carrier: Carrier;
  vendorName: string;
  model?: string;
}): Promise<SheetExtraction> {
  const basePrompt = PROMPTS[params.carrier];
  if (!basePrompt) throw new Error(`Unknown carrier: ${params.carrier}`);

  const prompt = `${basePrompt}

${ANTI_COPY_RULE}

거래처: **${params.vendorName}** (${params.carrier})`;

  const result = await visionExtract({
    imageBytes: params.imageBytes,
    prompt,
    schema: SheetExtraction,
    maxTokens: 64000,
    model: params.model ?? VISION_MODEL_PRIMARY,
  });
  return result;
}

export { VISION_MODEL_CLAUDE, VISION_MODEL_GEMINI, VISION_MODEL_GPT5 };

const ReparseResponse = z.object({
  models: z.array(
    z.object({
      model_code_raw: z.string(),
      nickname: z.string(),
      storage: z.string().nullable(),
      retail_price_krw: z.number(),
      is_new: z.boolean(),
      tiers: z.array(
        z.object({
          plan_tier_code: z.string(),
          subsidy_krw: z.number().nullable(),
          common: z
            .object({
              new010: z.number().nullable(),
              mnp: z.number().nullable(),
              change: z.number().nullable(),
            })
            .nullable(),
          select: z
            .object({
              new010: z.number().nullable(),
              mnp: z.number().nullable(),
              change: z.number().nullable(),
            })
            .nullable(),
        }),
      ),
    }),
  ),
});

/** 특정 model_code_raw들만 Opus로 다시 읽는다. 집중도 높아 정확도 크게 상승. */
export async function reparseRows(params: {
  imageBytes: Uint8Array | Buffer;
  carrier: Carrier;
  vendorName: string;
  targetModelCodes: string[];
}): Promise<ParsedModel[]> {
  const basePrompt = PROMPTS[params.carrier];
  if (!basePrompt) throw new Error(`Unknown carrier: ${params.carrier}`);

  const prompt = `${basePrompt}

${ANTI_COPY_RULE}

==============================
🎯 타겟 재파싱 작업
==============================
이번 호출은 **특정 모델만 정확히 재추출**하는 것이 목적입니다.
다른 모델은 절대 출력하지 마세요. 아래 model_code_raw 목록에 해당하는 행만:

${params.targetModelCodes.map((c) => `- ${c}`).join('\n')}

요청사항:
- 각 모델에 대해 모든 7개(SKT), 4~5개(KT), 7개(LGU+) 구간의 값을 **이미지에서 직접** 읽기
- 이전 파싱에서 이 모델들에 잘못된 값(반복/복사)이 들어있었으므로 **특히 주의**해서 각 셀을 개별 확인
- 확신 없으면 null (추측 금지)
- 출력 models 배열에는 위에 나열된 model_code_raw만 포함

거래처: **${params.vendorName}** (${params.carrier})`;

  const result = await visionExtract({
    imageBytes: params.imageBytes,
    prompt,
    schema: ReparseResponse,
    maxTokens: 24000,
    model: VISION_MODEL_REPARSE,
  });
  return result.models as ParsedModel[];
}
