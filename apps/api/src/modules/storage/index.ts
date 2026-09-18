import { env } from '../../config/env.js';
import { LocalStorageAdapter } from './local.adapter.js';
import { S3StorageAdapter } from './s3.adapter.js';

export interface StorageAdapter {
  saveFile(filename: string, buffer: Buffer): Promise<string>;
  getFile(filename: string): Promise<Buffer>;
  deleteFile(filename: string): Promise<void>;
}

let storageInstance: StorageAdapter | null = null;

export function getStorageAdapter(): StorageAdapter {
  if (storageInstance) return storageInstance;

  switch (env.STORAGE_PROVIDER) {
    case 's3':
    case 'r2':
      storageInstance = new S3StorageAdapter();
      break;
    case 'local':
    default:
      storageInstance = new LocalStorageAdapter();
      break;
  }

  return storageInstance;
}
