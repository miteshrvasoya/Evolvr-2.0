import { MediaProvider, MediaGenerationResult, MediaGenerationError, AssetErrorCategory } from './media.interface.js';
import { env } from '../../config/env.js';

const PROVIDER_NAME = 'lmstudio';

function classifyError(status?: number, body?: string): AssetErrorCategory {
  if (!status) return 'transient';
  if (status === 429) return 'rate_limited';
  if (status === 401 || status === 403) return 'auth_error';
  if (status === 400) {
    if (body?.toLowerCase().includes('invalid')) return 'invalid_prompt';
    return 'permanent';
  }
  if (status >= 500) return 'provider_error';
  return 'transient';
}

function buildMediaError(message: string, category: AssetErrorCategory, statusCode?: number, detail?: Record<string, any>): MediaGenerationError {
  const err = new Error(message) as MediaGenerationError;
  err.errorCategory = category;
  if (statusCode !== undefined) err.statusCode = statusCode;
  if (detail) err.providerDetail = detail;
  return err;
}

export class LMStudioMediaProvider implements MediaProvider {
  private async callLocalAPI(prompt: string, size: string): Promise<MediaGenerationResult> {
    const start = Date.now();
    const url = `${env.LMSTUDIO_API_URL}/images/generations`;
    console.log(`[LMStudioMediaProvider] Calling ${url} for prompt: "${prompt}"`);

    const payload = {
      prompt,
      size,
      n: 1,
      response_format: 'b64_json',
    };

    let response: Response;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120_000); // 2 min for local model
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer lm-studio',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (e: any) {
      if (e.name === 'AbortError') {
        throw buildMediaError('LM Studio request timed out after 120 seconds.', 'timeout');
      }
      throw buildMediaError(`LM Studio network error: ${e.message}`, 'transient');
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      const category = classifyError(response.status, errText);
      throw buildMediaError(
        `LM Studio API failed with status: ${response.status} - ${errText.slice(0, 200)}`,
        category,
        response.status,
        { body: errText.slice(0, 500) },
      );
    }

    const data = await response.json() as any;

    if (!data.data || !data.data[0]) {
      throw buildMediaError('LM Studio API returned invalid data format', 'provider_error');
    }

    const resultObj = data.data[0];
    let buffer: Buffer;

    if (resultObj.b64_json) {
      buffer = Buffer.from(resultObj.b64_json, 'base64');
    } else if (resultObj.url) {
      try {
        const imgResponse = await fetch(resultObj.url);
        if (!imgResponse.ok) throw new Error(`Failed to fetch image from URL: ${resultObj.url}`);
        const arrayBuffer = await imgResponse.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
      } catch (e: any) {
        throw buildMediaError(`Failed to retrieve generated image: ${e.message}`, 'provider_error');
      }
    } else {
      throw buildMediaError('LM Studio API did not return b64_json or url', 'provider_error');
    }

    const durationMs = Date.now() - start;

    return {
      buffer,
      mimeType: 'image/png',
      metadata: { provider: PROVIDER_NAME, prompt, size },
      provider: PROVIDER_NAME,
      durationMs,
    };
  }

  async generateImage(prompt: string): Promise<MediaGenerationResult> {
    return this.callLocalAPI(prompt, '1024x1024');
  }

  async generateReelPlaceholder(prompt: string): Promise<MediaGenerationResult> {
    return this.callLocalAPI(prompt, '1024x1792');
  }
}
