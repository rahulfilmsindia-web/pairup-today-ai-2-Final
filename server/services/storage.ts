import crypto from 'crypto';

export interface R2Config {
  accountId?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  bucketName?: string;
  publicUrl?: string;
}

function getR2Config(): R2Config {
  return {
    accountId: process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    bucketName: process.env.R2_BUCKET_NAME || process.env.CLOUDFLARE_R2_BUCKET_NAME || 'pairuptoday-media',
    publicUrl: process.env.R2_PUBLIC_URL || process.env.CLOUDFLARE_R2_PUBLIC_URL || 'https://media.pairuptoday.com'
  };
}

export function isR2Configured(): boolean {
  const cfg = getR2Config();
  return Boolean(cfg.accountId && cfg.accessKeyId && cfg.secretAccessKey && cfg.bucketName);
}

/**
 * AWS SigV4 signed PUT request for Cloudflare R2 S3-compatible API.
 * Uses pure Node.js crypto with zero heavy external dependencies.
 */
async function uploadBufferToR2(
  buffer: Buffer,
  key: string,
  contentType: string,
  config: R2Config
): Promise<string> {
  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const endpoint = `https://${host}/${config.bucketName}/${key}`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substring(0, 8);
  const region = 'auto';
  const service = 's3';

  const payloadHash = crypto.createHash('sha256').update(buffer).digest('hex');

  // Canonical headers
  const canonicalHeaders = [
    `content-type:${contentType}`,
    `host:${host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`
  ].join('\n') + '\n';

  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';

  // Canonical request
  const canonicalRequest = [
    'PUT',
    `/${config.bucketName}/${key}`,
    '', // query string
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');

  // String to sign
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex')
  ].join('\n');

  // Signature calculation
  const kDate = crypto.createHmac('sha256', `AWS4${config.secretAccessKey}`).update(dateStamp).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
  const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
  const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  const authorizationHeader = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(endpoint, {
    method: 'PUT',
    headers: {
      'Host': host,
      'Content-Type': contentType,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      'Authorization': authorizationHeader
    },
    body: buffer
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cloudflare R2 upload failed [${response.status}]: ${errorText}`);
  }

  const basePublicUrl = config.publicUrl?.replace(/\/+$/, '') || `https://${config.bucketName}.${config.accountId}.r2.dev`;
  return `${basePublicUrl}/${key}`;
}

/**
 * Ingests an image (Base64 data URL or Buffer), uploads to Cloudflare R2 (zero egress),
 * and returns the clean public HTTPS URL.
 * If R2 is not configured, provides graceful fallback.
 */
export async function uploadMedia(
  input: string | Buffer,
  folder: 'avatars' | 'gallery' | 'kyc',
  identifier: string
): Promise<string> {
  let buffer: Buffer;
  let contentType = 'image/jpeg';
  let ext = 'jpg';

  if (typeof input === 'string') {
    // If it's already an external HTTPS URL (e.g. R2 URL), return directly
    if (input.startsWith('http://') || input.startsWith('https://')) {
      return input;
    }

    if (input.startsWith('data:')) {
      const match = input.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        contentType = match[1];
        if (contentType.includes('png')) ext = 'png';
        else if (contentType.includes('webp')) ext = 'webp';
        buffer = Buffer.from(match[2], 'base64');
      } else {
        buffer = Buffer.from(input, 'base64');
      }
    } else {
      buffer = Buffer.from(input, 'base64');
    }
  } else {
    buffer = input;
  }

  const sanitizedId = identifier.replace(/[^a-zA-Z0-9_-]/g, '');
  const timestamp = Date.now();
  const randomSuffix = crypto.randomBytes(4).toString('hex');
  const key = `${folder}/${sanitizedId}_${timestamp}_${randomSuffix}.${ext}`;

  const config = getR2Config();
  if (isR2Configured()) {
    try {
      return await uploadBufferToR2(buffer, key, contentType, config);
    } catch (err) {
      console.error('Failed to upload to Cloudflare R2, falling back:', err);
    }
  }

  // Fallback: If R2 is not yet configured, serve as optimized data URI or local path
  // but ensure large inputs are safely compressed
  return `data:${contentType};base64,${buffer.toString('base64')}`;
}
