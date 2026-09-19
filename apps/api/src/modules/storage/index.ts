import { env } from '../../config/env.js';
import { LocalStorageAdapter } from './local.adapter.js';
import { R2StorageProvider } from './r2.provider.js';

export interface ObjectStorageService {
  saveFile(filename: string, buffer: Buffer): Promise<string>;
  getFile(filename: string): Promise<Buffer>;
  deleteFile(filename: string): Promise<void>;
  generatePresignedUrl(filename: string, contentType?: string): Promise<{ uploadUrl: string; storageUrl: string }>;
  generateDownloadUrl(key: string, expiresIn?: number): Promise<string>;
  objectExists(key: string): Promise<boolean>;
}

let storageInstance: ObjectStorageService | null = null;

export function getStorageAdapter(): ObjectStorageService {
  if (storageInstance) return storageInstance;

  switch (env.STORAGE_PROVIDER) {
    case 'r2':
      storageInstance = new R2StorageProvider();
      break;
    case 'local':
    default:
      storageInstance = new LocalStorageAdapter();
      break;
  }

  return storageInstance;
}
