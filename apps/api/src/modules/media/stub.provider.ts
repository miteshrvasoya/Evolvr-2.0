import { MediaProvider, MediaGenerationResult } from './media.interface.js';

export class StubMediaProvider implements MediaProvider {
  /**
   * Generates a 1x1 transparent GIF to act as a placeholder image.
   */
  async generateImage(prompt: string): Promise<MediaGenerationResult> {
    console.log(`[StubMediaProvider] Generating stub image for prompt: "${prompt}"`);
    const buffer = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    await new Promise(resolve => setTimeout(resolve, 200));
    return {
      buffer,
      mimeType: 'image/gif',
      metadata: { stub: true, prompt, width: 1080, height: 1080 },
      provider: 'stub',
      durationMs: 200,
    };
  }

  /**
   * Generates a solid color pixel to act as a reel cover placeholder.
   */
  async generateReelPlaceholder(prompt: string): Promise<MediaGenerationResult> {
    console.log(`[StubMediaProvider] Generating stub reel cover for prompt: "${prompt}"`);
    const buffer = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    await new Promise(resolve => setTimeout(resolve, 200));
    return {
      buffer,
      mimeType: 'image/gif',
      metadata: { stub: true, prompt, width: 1080, height: 1920 },
      provider: 'stub',
      durationMs: 200,
    };
  }
}
