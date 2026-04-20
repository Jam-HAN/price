import { visionExtract } from './ai';
import { SheetExtraction } from './vision-schema';
import { PROMPTS } from './vision-prompts';

export type Carrier = 'SKT' | 'KT' | 'LGU+';

export async function parseSheetImage(params: {
  imageBytes: Uint8Array | Buffer;
  carrier: Carrier;
  vendorName: string;
}): Promise<SheetExtraction> {
  const basePrompt = PROMPTS[params.carrier];
  if (!basePrompt) throw new Error(`Unknown carrier: ${params.carrier}`);

  const prompt = `${basePrompt}

거래처: **${params.vendorName}** (${params.carrier})`;

  const result = await visionExtract({
    imageBytes: params.imageBytes,
    prompt,
    schema: SheetExtraction,
    maxTokens: 16000,
  });
  return result;
}
