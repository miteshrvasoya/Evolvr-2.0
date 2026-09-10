import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { env } from '../../../config/env.js';
import { LLMProvider, LLMRequest, LLMResponse, StructuredLLMRequest } from '../llm.types.js';
import { LoggerService } from '../../common/logger.service.js';

export class OpenRouterAdapter implements LLMProvider {
  private client: OpenAI;
  private defaultModel: string;
  private strongModel: string;

  constructor() {
    this.client = new OpenAI({
      baseURL: env.OPENROUTER_BASE_URL,
      apiKey: env.OPENROUTER_API_KEY,
      timeout: 300000, // Explicitly set 5 minute timeout for long-running LLM generation
      maxRetries: 0, // Disable automatic retries which can abort and mask original timeouts
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
      });
    } catch (e: any) {
      const latencyMs = Date.now() - start;
      LoggerService.logApiCall({
        direction: 'outward',
        method: 'POST',
        url: `${env.OPENROUTER_BASE_URL}/chat/completions`,
        statusCode: e.status || 500,
        requestPayload: { model: this.defaultModel, userPrompt: request.userPrompt },
        responsePayload: { error: e.message },
        latencyMs
      });
      LoggerService.logError({
        errorMessage: e.message || 'LLM API Error',
        stackTrace: e.stack,
        context: {
          action: 'OpenRouterAdapter.generateText',
          model: this.defaultModel
        }
      });
      throw e;
    }

    const content = response.choices[0]?.message?.content || '';

    LoggerService.logApiCall({
      direction: 'outward',
      method: 'POST',
      url: `${env.OPENROUTER_BASE_URL}/chat/completions`,
      statusCode: 200,
      requestPayload: { model: this.defaultModel, userPrompt: request.userPrompt },
      responsePayload: { content },
      latencyMs: Date.now() - start
    });

    return {
      content,
      model: response.model,
      inputTokens: response.usage?.prompt_tokens || 0,
      outputTokens: response.usage?.completion_tokens || 0,
      latencyMs: Date.now() - start,
    };
  }

  async generateStructured<T>(request: StructuredLLMRequest<T>): Promise<LLMResponse<T>> {
    const start = Date.now();

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
      });
    } catch (e: any) {
      const latencyMs = Date.now() - start;
      LoggerService.logApiCall({
        direction: 'outward',
        method: 'POST',
        url: `${env.OPENROUTER_BASE_URL}/chat/completions`,
        statusCode: e.status || 500,
        requestPayload: { model: this.strongModel, schema: request.schemaName, userPrompt: request.userPrompt },
        responsePayload: { error: e.message },
        latencyMs
      });
      LoggerService.logError({
        errorMessage: e.message || 'LLM API Error',
        stackTrace: e.stack,
        context: {
          action: 'OpenRouterAdapter.generateStructured',
          model: this.strongModel,
          schemaName: request.schemaName
        }
      });
      throw e;
    }

    const content = response.choices[0]?.message?.content || '';

    LoggerService.logApiCall({
      direction: 'outward',
      method: 'POST',
      url: `${env.OPENROUTER_BASE_URL}/chat/completions`,
      statusCode: 200,
      requestPayload: { model: this.strongModel, schema: request.schemaName, userPrompt: request.userPrompt },
      responsePayload: { content },
      latencyMs: Date.now() - start
    });
    let structured: T | undefined;

    try {
      if (content) {
        // Strip markdown blocks if present
        let cleanContent = content;
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          cleanContent = jsonMatch[1].trim();
        } else {
          // If no markdown, strip text before first { or [ and after last } or ]
          const startIdx = Math.min(
            cleanContent.indexOf('{') === -1 ? Infinity : cleanContent.indexOf('{'),
            cleanContent.indexOf('[') === -1 ? Infinity : cleanContent.indexOf('[')
          );
          const endIdx = Math.max(
            cleanContent.lastIndexOf('}'),
            cleanContent.lastIndexOf(']')
          );
          if (startIdx !== Infinity && endIdx !== -1 && endIdx >= startIdx) {
            cleanContent = cleanContent.substring(startIdx, endIdx + 1);
          }
        }
        
        structured = JSON.parse(cleanContent.trim()) as T;
      }
    } catch (e) {
      throw new Error(`Failed to parse structured output: ${e}. Raw content: ${content.substring(0, 50)}...`);
    }

    const latencyMs = Date.now() - start;
    const inputTokens = response.usage?.prompt_tokens || 0;
    const outputTokens = response.usage?.completion_tokens || 0;

    // Fire and forget usage tracking (cost logic abstracted for scaffold)
    // Avoid circular dependency by importing dynamically or just raw SQL here
    import('../../../db/client.js').then(({ sql }) => {
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
