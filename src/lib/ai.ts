import { generateText, Output } from 'ai';
import { z } from 'zod';

export const VISION_MODEL = 'anthropic/claude-sonnet-4.6';

export async function visionExtract<T extends z.ZodTypeAny>(params: {
  imageBytes: Uint8Array | Buffer;
  prompt: string;
  schema: T;
  maxTokens?: number;
}): Promise<z.infer<T>> {
  const result = await generateText({
    model: VISION_MODEL,
    output: Output.object({ schema: params.schema }),
    maxOutputTokens: params.maxTokens ?? 32000,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', image: params.imageBytes },
          { type: 'text', text: params.prompt },
        ],
      },
    ],
  });
  try {
    return result.output as z.infer<T>;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Vision failed: ${msg}. finishReason=${result.finishReason} usage=${JSON.stringify(result.usage)} textPreview=${(result.text ?? '').slice(0, 600)}`,
    );
  }
}
