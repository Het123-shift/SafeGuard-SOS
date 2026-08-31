import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env';

// S3 Client configured for Cloudflare R2
const endpoint = env.R2_ENDPOINT || (env.R2_ACCOUNT_ID ? `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : undefined);

export const s3Client = new S3Client({
  region: 'auto',
  endpoint: endpoint,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID || 'mock_key',
    secretAccessKey: env.R2_SECRET_ACCESS_KEY || 'mock_secret',
  },
});

export const R2StorageService = {
  /**
   * Generate a presigned upload URL for encrypted evidence.
   * Path convention: {userId}/{eventId}_{timestamp}.enc
   * Expiry: 5 minutes (300 seconds)
   */
  async getPresignedUploadUrl(
    userId: string,
    fileName: string,
    contentType: string = 'application/octet-stream'
  ): Promise<{ uploadUrl: string; filePath: string }> {
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${userId}/${Date.now()}_${sanitizedFileName}.enc`;

    const command = new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: filePath,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });
    return { uploadUrl, filePath };
  },

  /**
   * Generate a short-lived presigned download URL for evidence.
   * Expiry: STRICT 60 SECONDS.
   */
  async getPresignedDownloadUrl(filePath: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: filePath,
    });

    return await getSignedUrl(s3Client, command, { expiresIn: 60 });
  },

  /**
   * Delete an evidence object from R2.
   */
  async deleteEvidenceObject(filePath: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: filePath,
    });
    await s3Client.send(command);
  },
};
