import { MediaProvider, MediaGenerationResult } from './media.interface.js';

export class PollinationsMediaProvider implements MediaProvider {
  async generateImage(prompt: string): Promise<MediaGenerationResult> {
    console.log(`[PollinationsMediaProvider] Generating image for prompt: "${prompt}"`);
    
    const safePrompt = prompt || 'A highly aesthetic lifestyle photo';
    const encodedPrompt = encodeURIComponent(safePrompt);
    const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1080&height=1080&nologo=true&seed=${Math.floor(Math.random() * 100000)}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Pollinations API failed with status: ${response.status}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      return {
        buffer,
        mimeType: 'image/jpeg',
        metadata: { provider: 'pollinations', prompt: safePrompt, width: 1080, height: 1080 }
      };
    } catch (e) {
      console.error('[PollinationsMediaProvider] Error generating image', e);
      throw e;
    }
  }

  async generateReelPlaceholder(prompt: string): Promise<MediaGenerationResult> {
    console.log(`[PollinationsMediaProvider] Generating reel cover for prompt: "${prompt}"`);
    
    const safePrompt = prompt || 'A cinematic vertical video cover shot';
    const encodedPrompt = encodeURIComponent(safePrompt);
    const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1080&height=1920&nologo=true&seed=${Math.floor(Math.random() * 100000)}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Pollinations API failed with status: ${response.status}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      return {
        buffer,
        mimeType: 'image/jpeg',
        metadata: { provider: 'pollinations', prompt: safePrompt, width: 1080, height: 1920 }
      };
    } catch (e) {
      console.error('[PollinationsMediaProvider] Error generating reel cover', e);
      throw e;
    }
  }
}
