import { MediaProvider, MediaGenerationResult } from './media.interface.js';
import { env } from '../../config/env.js';

export class LMStudioMediaProvider implements MediaProvider {
  private async callLocalAPI(prompt: string, size: string): Promise<MediaGenerationResult> {
    const url = `${env.LMSTUDIO_API_URL}/images/generations`;
    console.log(`[LMStudioMediaProvider] Calling ${url} for prompt: "${prompt}"`);

    const payload = {
      prompt,
      size,
      n: 1,
      response_format: 'b64_json',
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer lm-studio'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`LM Studio API failed with status: ${response.status} - ${errText}`);
      }

      const data = await response.json();
      
      if (!data.data || !data.data[0]) {
        throw new Error('LM Studio API returned invalid data format');
      }

      const resultObj = data.data[0];
      
      let buffer: Buffer;
      if (resultObj.b64_json) {
        buffer = Buffer.from(resultObj.b64_json, 'base64');
      } else if (resultObj.url) {
        // Fallback in case LM Studio ignores response_format and returns a URL
        const imgResponse = await fetch(resultObj.url);
        if (!imgResponse.ok) throw new Error(`Failed to fetch image from URL: ${resultObj.url}`);
        const arrayBuffer = await imgResponse.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
      } else {
        throw new Error('LM Studio API did not return b64_json or url');
      }

      return {
        buffer,
        mimeType: 'image/png', // Typically models like SD return PNGs
        metadata: { provider: 'lmstudio', prompt, size }
      };
    } catch (e) {
      console.error('[LMStudioMediaProvider] Error generating image', e);
      throw e;
    }
  }

  async generateImage(prompt: string): Promise<MediaGenerationResult> {
    return this.callLocalAPI(prompt, '1024x1024');
  }

  async generateReelPlaceholder(prompt: string): Promise<MediaGenerationResult> {
    // Some models don't support arbitrary sizes, but 576x1024 or 1024x1792 is a vertical ratio
    return this.callLocalAPI(prompt, '1024x1792');
  }
}
