import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { env } from '../../../config/env.js';
import { LLMProvider, LLMRequest, LLMResponse, StructuredLLMRequest } from '../llm.types.js';

export class OpenRouterAdapter implements LLMProvider {
  private client: OpenAI;
  private defaultModel: string;
  private strongModel: string;

  constructor() {
    this.client = new OpenAI({
      baseURL: env.OPENROUTER_BASE_URL,
      apiKey: env.OPENROUTER_API_KEY,
      defaultHeaders: {
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Evolvr',
      },
    });
    this.defaultModel = env.OPENROUTER_DEFAULT_MODEL;
    this.strongModel = env.OPENROUTER_STRONG_MODEL;
  }

  async generateText(request: LLMRequest): Promise<LLMResponse> {
    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutes

    let response;
    try {
      response = await this.client.chat.completions.create({
        model: this.defaultModel,
        messages: [
          { role: 'system', content: request.systemPrompt },
          { role: 'user', content: request.userPrompt },
        ],
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens,
      }, { signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }

    return {
      content: response.choices[0]?.message?.content || '',
      model: response.model,
      inputTokens: response.usage?.prompt_tokens || 0,
      outputTokens: response.usage?.completion_tokens || 0,
      latencyMs: Date.now() - start,
    };
  }

  async generateStructured<T>(request: StructuredLLMRequest<T>): Promise<LLMResponse<T>> {
    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutes

    let response;
    try {
      response = await this.client.chat.completions.create({
        model: this.strongModel, // Use strong model for structured outputs/reasoning
        messages: [
          { role: 'system', content: request.systemPrompt },
          { role: 'user', content: request.userPrompt },
        ],
        temperature: request.temperature ?? 0.2,
        max_tokens: request.maxTokens,
        response_format: zodResponseFormat(request.outputSchema, request.schemaName),
      }, { signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }

    const content = response.choices[0]?.message?.content || '';
    let structured: T | undefined;

    try {
      if (content) {
        structured = JSON.parse(content) as T;
      }
    } catch (e) {
      throw new Error(`Failed to parse structured output: ${e}`);
    }

    const latencyMs = Date.now() - start;
    const inputTokens = response.usage?.prompt_tokens || 0;
    const outputTokens = response.usage?.completion_tokens || 0;

    // Fire and forget usage tracking (cost logic abstracted for scaffold)
    // Avoid circular dependency by importing dynamically or just raw SQL here
    import('../../db/client.js').then(({ sql }) => {
      sql`
        INSERT INTO llm_usage_records (
          provider, model, input_tokens, output_tokens, latency_ms, task_type
        ) VALUES (
          'openrouter', ${response.model}, ${inputTokens}, ${outputTokens}, ${latencyMs}, ${request.schemaName}
        )
      `.catch(e => console.error('Failed to log LLM usage', e));
    });

    return {
      content,
      structured,
      model: response.model,
      inputTokens,
      outputTokens,
      latencyMs,
    };
  }
}
