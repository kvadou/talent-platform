import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { Readable } from 'stream';
import { Upload } from '@aws-sdk/lib-storage';

const region = process.env.AWS_REGION ?? 'us-east-1';
const bucket = process.env.AWS_S3_BUCKET ?? '';

export const s3Client = new S3Client({
  region,
  credentials: process.env.AWS_ACCESS_KEY_ID
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
      }
    : undefined
});

export async function getResumeUploadUrl(contentType: string) {
  if (!bucket) throw new Error('S3 bucket not configured');

  // Map content type to file extension
  const extensionMap: Record<string, string> = {
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'text/plain': '.txt',
  };
  const extension = extensionMap[contentType] || '';

  const key = `resumes/${randomUUID()}${extension}`;
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
    ACL: 'private'
  });
  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });
  return { uploadUrl, fileUrl: key }; // fileUrl is the S3 key for later retrieval
}

export function getPublicFileUrl(key: string) {
  if (!bucket) throw new Error('S3 bucket not configured');
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

export async function getResumeDownloadUrl(key: string) {
  if (!bucket) throw new Error('S3 bucket not configured');
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseContentType: 'application/pdf',
    ResponseContentDisposition: 'inline',
  });
  const url = await getSignedUrl(s3Client, command, { expiresIn: 300 });
  return url;
}

export async function downloadResumeBuffer(key: string): Promise<Buffer> {
  if (!bucket) throw new Error('S3 bucket not configured');
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  const response = await s3Client.send(command);

  if (!response.Body) {
    throw new Error('Empty response body from S3');
  }

  // Convert stream to buffer
  const stream = response.Body as Readable;
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

// ============================================
// INTERVIEW RECORDING FUNCTIONS
// ============================================

/**
 * Upload an interview recording (video or audio) to S3
 * Supports large files with multipart upload
 */
export async function uploadInterviewRecording(
  interviewId: string,
  buffer: Buffer,
  fileType: 'video' | 'audio',
  extension: string
): Promise<{ key: string; url: string; size: number }> {
  if (!bucket) throw new Error('S3 bucket not configured');

  const key = `recordings/${interviewId}/${fileType}.${extension}`;
  const contentType = fileType === 'video' ? 'video/mp4' : 'audio/m4a';

  // Use multipart upload for large files
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    },
    // Chunk size: 5MB minimum, 10MB for larger files
    partSize: Math.max(5 * 1024 * 1024, Math.ceil(buffer.length / 100)),
    queueSize: 4, // Concurrent uploads
  });

  await upload.done();

  return {
    key,
    url: getPublicFileUrl(key),
    size: buffer.length,
  };
}

/**
 * Get a signed URL for streaming/downloading a recording
 * URLs expire after 1 hour by default
 */
export async function getRecordingStreamUrl(key: string, expiresIn = 3600): Promise<string> {
  if (!bucket) throw new Error('S3 bucket not configured');
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Check if a recording file exists in S3
 */
export async function recordingExists(key: string): Promise<boolean> {
  if (!bucket) return false;
  try {
    const command = new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    await s3Client.send(command);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get recording metadata (size, content type)
 */
export async function getRecordingMetadata(key: string): Promise<{ size: number; contentType: string } | null> {
  if (!bucket) return null;
  try {
    const command = new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    const response = await s3Client.send(command);
    return {
      size: response.ContentLength || 0,
      contentType: response.ContentType || 'application/octet-stream',
    };
  } catch {
    return null;
  }
}
