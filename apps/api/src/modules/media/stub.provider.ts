import { MediaProvider, MediaGenerationResult } from './media.interface.js';

export class StubMediaProvider implements MediaProvider {
  /**
   * Generates a 1x1 solid color pixel to act as a placeholder image.
   * In a real implementation, this would call DALL-E or Stability AI.
   */
  async generateImage(prompt: string): Promise<MediaGenerationResult> {
    console.log(`[StubMediaProvider] Generating stub image for prompt: "${prompt}"`);
    // A 1x1 transparent GIF buffer
    const buffer = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      buffer,
      mimeType: 'image/gif',
      metadata: { stub: true, prompt, width: 1080, height: 1080 }
    };
  }

  /**
   * Generates a solid color pixel to act as a reel cover placeholder.
   */
  async generateReelPlaceholder(prompt: string): Promise<MediaGenerationResult> {
    console.log(`[StubMediaProvider] Generating stub reel cover for prompt: "${prompt}"`);
    // A 1x1 transparent GIF buffer
    const buffer = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      buffer,
      mimeType: 'image/gif',
      metadata: { stub: true, prompt, width: 1080, height: 1920 }
    };
  }
}
