import { generateText, Output } from 'ai';
import { z } from 'zod';

export const VISION_MODEL_PRIMARY = 'anthropic/claude-sonnet-4.6';
export const VISION_MODEL_REPARSE = 'anthropic/claude-opus-4.7';
export const VISION_MODEL_GEMINI = 'google/gemini-3.1-pro-preview';
export const VISION_MODEL_CLAUDE = 'anthropic/claude-sonnet-4.6';
export const VISION_MODEL_GPT5 = 'openai/gpt-5';
export const VISION_MODEL = VISION_MODEL_PRIMARY;

export async function visionExtract<T extends z.ZodTypeAny>(params: {
  imageBytes: Uint8Array | Buffer;
  prompt: string;
  schema: T;
  maxTokens?: number;
  model?: string;
}): Promise<z.infer<T>> {
  const result = await generateText({
    model: params.model ?? VISION_MODEL,
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
