import fs from 'fs/promises';
import path from 'path';
import { env } from '../../config/env.js';

export class LocalStorageAdapter {
  private readonly storageDir: string;

  constructor() {
    this.storageDir = path.resolve(env.STORAGE_LOCAL_DIR);
  }

  async init() {
    try {
      await fs.access(this.storageDir);
    } catch {
      await fs.mkdir(this.storageDir, { recursive: true });
    }
  }

  async saveFile(filename: string, buffer: Buffer): Promise<string> {
    await this.init();
    const filePath = path.join(this.storageDir, filename);
    await fs.writeFile(filePath, buffer);
    // Return relative URL path for serving statically
    return `/storage/${filename}`;
  }

  async generatePresignedUrl(filename: string, contentType?: string): Promise<{ uploadUrl: string; storageUrl: string }> {
    const storageUrl = filename; // We use object_key for both R2 and local now
    const uploadUrl = `/api/media/local-upload?filename=${encodeURIComponent(filename)}`;
    return { uploadUrl, storageUrl };
  }

  async generateDownloadUrl(key: string, expiresIn?: number): Promise<string> {
    // For local, we just return the local storage path
    return `/storage/${key}`;
  }

  async objectExists(key: string): Promise<boolean> {
    try {
      const filePath = path.join(this.storageDir, key);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async getFile(filename: string): Promise<Buffer> {
    const filePath = path.join(this.storageDir, filename);
    return await fs.readFile(filePath);
  }

  async deleteFile(filename: string): Promise<void> {
    const filePath = path.join(this.storageDir, filename);
    await fs.unlink(filePath);
  }
}
