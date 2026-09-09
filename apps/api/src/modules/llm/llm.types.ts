import { z } from 'zod';

export interface LLMResponse<T = any> {
  content: string;
  structured?: T;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

export interface LLMRequest {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

export interface StructuredLLMRequest<T> extends LLMRequest {
  outputSchema: z.ZodType<T>;
  schemaName: string;
  schemaDescription?: string;
}

export interface LLMProvider {
  generateText(request: LLMRequest): Promise<LLMResponse>;
  generateStructured<T>(request: StructuredLLMRequest<T>): Promise<LLMResponse<T>>;
}
