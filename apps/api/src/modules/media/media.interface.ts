export type AssetErrorCategory =
  | 'transient'
  | 'rate_limited'
  | 'timeout'
  | 'provider_error'
  | 'auth_error'
  | 'invalid_prompt'
  | 'content_policy'
  | 'quota_exceeded'
  | 'permanent';

export interface MediaGenerationResult {
  buffer: Buffer;
  mimeType: string;
  metadata?: Record<string, any>;
  /** Provider name that produced this result */
  provider?: string;
  /** Model used, if applicable */
  model?: string;
  /** Actual generation duration in ms */
  durationMs?: number;
}

export interface MediaGenerationError extends Error {
  /** Structured category for retry decision logic */
  errorCategory: AssetErrorCategory;
  /** HTTP status code from provider (if applicable) */
  statusCode?: number;
  /** Raw provider payload */
  providerDetail?: Record<string, any>;
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
