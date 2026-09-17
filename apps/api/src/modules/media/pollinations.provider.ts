import { MediaProvider, MediaGenerationResult, MediaGenerationError, AssetErrorCategory } from './media.interface.js';

const PROVIDER_NAME = 'pollinations';

function classifyHttpError(status: number, body?: string): AssetErrorCategory {
  if (status === 429) return 'rate_limited';
  if (status === 401 || status === 403) return 'auth_error';
  if (status === 400) {
    if (body?.toLowerCase().includes('content policy') || body?.toLowerCase().includes('safety')) return 'content_policy';
    if (body?.toLowerCase().includes('invalid prompt') || body?.toLowerCase().includes('prompt')) return 'invalid_prompt';
    return 'permanent';
  }
  if (status >= 500) return 'provider_error';
  return 'transient';
}

function buildMediaError(message: string, category: AssetErrorCategory, statusCode?: number, providerDetail?: Record<string, any>): MediaGenerationError {
  const err = new Error(message) as MediaGenerationError;
  err.errorCategory = category;
  if (statusCode !== undefined) err.statusCode = statusCode;
  if (providerDetail) err.providerDetail = providerDetail;
  return err;
}

export class PollinationsMediaProvider implements MediaProvider {
  async generateImage(prompt: string): Promise<MediaGenerationResult> {
    const start = Date.now();
    console.log(`[PollinationsMediaProvider] Generating image for prompt: "${prompt}"`);

    const safePrompt = prompt || 'A highly aesthetic lifestyle photo';
    const encodedPrompt = encodeURIComponent(safePrompt);
    const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1080&height=1080&nologo=true&seed=${Math.floor(Math.random() * 100000)}`;

    let response: Response;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60_000); // 60s timeout
      response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
    } catch (e: any) {
      if (e.name === 'AbortError') {
        throw buildMediaError('Request timed out after 60 seconds.', 'timeout');
      }
      throw buildMediaError(`Network error: ${e.message}`, 'transient');
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      const category = classifyHttpError(response.status, body);
      throw buildMediaError(
        `Pollinations API failed with status: ${response.status}`,
        category,
        response.status,
        { body: body.slice(0, 500) },
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const durationMs = Date.now() - start;

    return {
      buffer,
      mimeType: 'image/jpeg',
      metadata: { provider: PROVIDER_NAME, prompt: safePrompt, width: 1080, height: 1080 },
      provider: PROVIDER_NAME,
      durationMs,
    };
  }

  async generateReelPlaceholder(prompt: string): Promise<MediaGenerationResult> {
    const start = Date.now();
    console.log(`[PollinationsMediaProvider] Generating reel cover for prompt: "${prompt}"`);

    const safePrompt = prompt || 'A cinematic vertical video cover shot';
    const encodedPrompt = encodeURIComponent(safePrompt);
    const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1080&height=1920&nologo=true&seed=${Math.floor(Math.random() * 100000)}`;

    let response: Response;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60_000);
      response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
    } catch (e: any) {
      if (e.name === 'AbortError') {
        throw buildMediaError('Request timed out after 60 seconds.', 'timeout');
      }
      throw buildMediaError(`Network error: ${e.message}`, 'transient');
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      const category = classifyHttpError(response.status, body);
      throw buildMediaError(
        `Pollinations API failed with status: ${response.status}`,
        category,
        response.status,
        { body: body.slice(0, 500) },
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const durationMs = Date.now() - start;

    return {
      buffer,
      mimeType: 'image/jpeg',
      metadata: { provider: PROVIDER_NAME, prompt: safePrompt, width: 1080, height: 1920 },
      provider: PROVIDER_NAME,
      durationMs,
    };
  }
}
