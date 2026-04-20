import { generateText, Output } from 'ai';
import { z } from 'zod';

export const VISION_MODEL = 'anthropic/claude-sonnet-4.6';

export async function visionExtract<T extends z.ZodTypeAny>(params: {
  imageBytes: Uint8Array | Buffer;
  prompt: string;
  schema: T;
  maxTokens?: number;
}): Promise<z.infer<T>> {
  const { output } = await generateText({
    model: VISION_MODEL,
    output: Output.object({ schema: params.schema }),
    maxOutputTokens: params.maxTokens ?? 8000,
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
  return output as z.infer<T>;
}
