import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../../config/env.js';
import { randomUUID } from 'crypto';

export class S3StorageAdapter {
  private client: S3Client;
  private bucket: string;
  private publicUrl: string;

  constructor() {
    this.bucket = env.STORAGE_BUCKET;
    this.publicUrl = env.STORAGE_PUBLIC_URL || `https://${this.bucket}.s3.${env.STORAGE_REGION}.amazonaws.com`;
    
    this.client = new S3Client({
      region: env.STORAGE_REGION,
      credentials: {
        accessKeyId: env.STORAGE_ACCESS_KEY,
        secretAccessKey: env.STORAGE_SECRET_KEY,
      },
      // If endpoint is provided (e.g. for MinIO/R2), use it
      ...(env.STORAGE_ENDPOINT ? { endpoint: env.STORAGE_ENDPOINT } : {}),
      forcePathStyle: !!env.STORAGE_ENDPOINT, // Required for many S3-compatible APIs
    });
  }

  async saveFile(filename: string, buffer: Buffer): Promise<string> {
    const key = `uploads/${randomUUID()}_${filename}`;
    
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        // Optional: you can dynamically pass mime type if needed, or rely on S3 inference/default
      })
    );

    return `${this.publicUrl}/${key}`;
  }

  async generatePresignedUrl(filename: string, contentType?: string): Promise<{ uploadUrl: string; storageUrl: string }> {
    const key = `uploads/${randomUUID()}_${filename}`;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: 3600 });
    return {
      uploadUrl,
      storageUrl: `${this.publicUrl}/${key}`,
    };
  }

  async getFile(filename: string): Promise<Buffer> {
    const key = filename.startsWith(this.publicUrl)
      ? filename.replace(`${this.publicUrl}/`, '')
      : filename;

    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );

    if (!response.Body) {
      throw new Error(`File not found: ${key}`);
    }
    
    // Convert streaming body to buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  async deleteFile(filename: string): Promise<void> {
    const key = filename.startsWith(this.publicUrl)
      ? filename.replace(`${this.publicUrl}/`, '')
      : filename;

    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );
  }
}
