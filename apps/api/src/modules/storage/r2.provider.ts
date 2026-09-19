import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../../config/env.js';
import { randomUUID } from 'crypto';
import { ObjectStorageService } from './index.js';

export class R2StorageProvider implements ObjectStorageService {
  private client: S3Client;
  private bucket: string;

  constructor() {
    this.bucket = env.R2_BUCKET_NAME;
    
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true,
    });
  }

  async saveFile(filename: string, buffer: Buffer): Promise<string> {
    const key = filename; // Assuming filename is already formatted as the object key correctly (e.g. users/userId/uploads/...)
    
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
      })
    );

    return key;
  }

  async generatePresignedUrl(filename: string, contentType?: string): Promise<{ uploadUrl: string; storageUrl: string }> {
    const key = filename; // Object key
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: 300 }); // 5 minutes
    return {
      uploadUrl,
      storageUrl: key, // Return the key instead of a full public URL since R2 bucket is private
    };
  }

  async getFile(filename: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: filename,
      })
    );

    if (!response.Body) {
      throw new Error(`File not found: ${filename}`);
    }
    
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  async deleteFile(filename: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: filename,
      })
    );
  }

  async generateDownloadUrl(key: string, expiresIn: number = 600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return await getSignedUrl(this.client, command, { expiresIn }); // Default 10 minutes
  }

  async objectExists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      );
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw error;
    }
  }
}
