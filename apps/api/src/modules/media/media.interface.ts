export interface MediaGenerationResult {
  buffer: Buffer;
  mimeType: string;
  metadata?: any;
}

export interface MediaProvider {
  /**
   * Generates a 1:1 image.
   * @param prompt Detailed description of the image to generate
   */
  generateImage(prompt: string): Promise<MediaGenerationResult>;
  
  /**
   * Generates a reel/video cover image placeholder.
   * @param prompt Detailed description of the video cover
   */
  generateReelPlaceholder(prompt: string): Promise<MediaGenerationResult>;
}
