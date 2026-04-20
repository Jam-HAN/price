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
  if (result.output == null) {
    const err = new Error(
      `Vision output empty. finishReason=${result.finishReason} usage=${JSON.stringify(result.usage)} textPreview=${(result.text ?? '').slice(0, 500)}`,
    );
    throw err;
  }
  return result.output as z.infer<T>;
}
