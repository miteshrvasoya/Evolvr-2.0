import { env } from '../../config/env.js';
import { LLMProvider } from './llm.types.js';
import { OpenRouterAdapter } from './adapters/openrouter.adapter.js';

let providerInstance: LLMProvider | null = null;

export function getLLMProvider(): LLMProvider {
  if (providerInstance) return providerInstance;

  switch (env.LLM_PROVIDER) {
    case 'openrouter':
      providerInstance = new OpenRouterAdapter();
      break;
    // Add other providers (gemini, openai, anthropic) as needed
    default:
      providerInstance = new OpenRouterAdapter();
  }

  return providerInstance;
}
