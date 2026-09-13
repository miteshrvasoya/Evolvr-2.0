import { env } from '../../config/env.js';
import { MediaProvider } from './media.interface.js';
import { StubMediaProvider } from './stub.provider.js';
import { PollinationsMediaProvider } from './pollinations.provider.js';
import { LMStudioMediaProvider } from './lmstudio.provider.js';

let providerInstance: MediaProvider | null = null;

export function getMediaProvider(): MediaProvider {
  if (providerInstance) return providerInstance;

  switch (env.MEDIA_PROVIDER) {
    case 'lmstudio':
      providerInstance = new LMStudioMediaProvider();
      break;
    case 'openai-dall-e':
    case 'stability-ai':
      console.warn(`[Media] ${env.MEDIA_PROVIDER} is not fully implemented yet. Falling back to Pollinations AI.`);
      providerInstance = new PollinationsMediaProvider();
      break;
    case 'stub':
      providerInstance = new StubMediaProvider();
      break;
    default:
      providerInstance = new PollinationsMediaProvider();
      break;
  }

  return providerInstance;
}
