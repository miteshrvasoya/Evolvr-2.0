import { env } from '../../config/env.js';
import { MediaProvider } from './media.interface.js';
import { StubMediaProvider } from './stub.provider.js';

let providerInstance: MediaProvider | null = null;

export function getMediaProvider(): MediaProvider {
  if (providerInstance) return providerInstance;

  switch (env.MEDIA_PROVIDER) {
    case 'openai-dall-e':
    case 'stability-ai':
      // Not implemented yet, falling back to stub
      console.warn(`[Media] ${env.MEDIA_PROVIDER} is not fully implemented yet. Falling back to stub.`);
      providerInstance = new StubMediaProvider();
      break;
    case 'stub':
    default:
      providerInstance = new StubMediaProvider();
      break;
  }

  return providerInstance;
}
