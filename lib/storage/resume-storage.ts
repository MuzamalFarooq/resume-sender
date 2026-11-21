import "server-only";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";
import { contentDisposition } from "@/lib/resumes/pdf";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const storageConfigSchema = z
  .object({
    provider: z.enum(["aws", "s3-compatible"]).default("aws"),
    endpoint: z.string().url().optional(),
    region: z.string().trim().min(1).default("us-east-1"),
    bucket: z.string().trim().min(1),
    accessKeyId: z.string().trim().min(1),
    secretAccessKey: z.string().min(1),
    forcePathStyle: z.enum(["true", "false"]).default("false"),
    signedUrlTtlSeconds: z.coerce.number().int().min(60).max(300).default(120),
    maxFileSizeBytes: z.coerce.number().int().min(1).max(MAX_FILE_SIZE_BYTES).default(MAX_FILE_SIZE_BYTES),
  })
  .superRefine((config, context) => {
    if (config.provider === "s3-compatible" && !config.endpoint) {
      context.addIssue({
        code: "custom",
        path: ["endpoint"],
        message: "An endpoint is required for S3-compatible storage.",
      });
    }
  });

export type ResumeStorageConfig = z.infer<typeof storageConfigSchema>;

export class StorageConfigurationError extends Error {
  constructor() {
    super("Private resume storage is not configured.");
    this.name = "StorageConfigurationError";
  }
}

export class StorageOperationError extends Error {
  constructor() {
    super("Private resume storage operation failed.");
    this.name = "StorageOperationError";
  }
}

let client: S3Client | undefined;
let bucket: string | undefined;
let signedUrlTtlSeconds: number | undefined;
let maxFileSizeBytes: number | undefined;

export function getResumeStorageConfig(): ResumeStorageConfig {
  const parsed = storageConfigSchema.safeParse({
    provider: process.env.STORAGE_PROVIDER,
    endpoint: process.env.STORAGE_ENDPOINT || undefined,
    region: process.env.STORAGE_REGION,
    bucket: process.env.STORAGE_BUCKET,
    accessKeyId: process.env.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY,
    forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE,
    signedUrlTtlSeconds: process.env.STORAGE_SIGNED_URL_TTL_SECONDS,
    maxFileSizeBytes: process.env.RESUME_MAX_FILE_SIZE_BYTES,
  });

  if (!parsed.success) {
    throw new StorageConfigurationError();
  }

  return parsed.data;
}

function getClient() {
  const config = getResumeStorageConfig();
  if (!client) {
    client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle === "true",
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
    bucket = config.bucket;
    signedUrlTtlSeconds = config.signedUrlTtlSeconds;
    maxFileSizeBytes = config.maxFileSizeBytes;
  }

  return {
    client,
    bucket: bucket ?? config.bucket,
    signedUrlTtlSeconds: signedUrlTtlSeconds ?? config.signedUrlTtlSeconds,
    maxFileSizeBytes: maxFileSizeBytes ?? config.maxFileSizeBytes,
  };
}

export function getConfiguredResumeSizeLimit() {
  return getResumeStorageConfig().maxFileSizeBytes;
}

export async function putResumeObject(key: string, body: Buffer) {
  const storage = getClient();
  try {
    await storage.client.send(
      new PutObjectCommand({
        Bucket: storage.bucket,
        Key: key,
        Body: body,
        ContentLength: body.length,
        ContentType: "application/pdf",
        ContentDisposition: contentDisposition("attachment", "resume.pdf"),
        CacheControl: "private, no-store",
      }),
    );
  } catch {
    throw new StorageOperationError();
  }
}

export async function deleteResumeObject(key: string) {
  const storage = getClient();
  try {
    await storage.client.send(
      new DeleteObjectCommand({
        Bucket: storage.bucket,
        Key: key,
      }),
    );
  } catch {
    throw new StorageOperationError();
  }
}

export async function readResumeObject(key: string) {
  const storage = getClient();
  try {
    const result = await storage.client.send(
      new GetObjectCommand({
        Bucket: storage.bucket,
        Key: key,
      }),
    );
    if (!result.Body) {
      throw new Error("Resume object body is missing.");
    }

    return Buffer.from(await result.Body.transformToByteArray());
  } catch {
    throw new StorageOperationError();
  }
}

export async function createResumeDownloadUrl(
  key: string,
  fileName: string,
  mode: "inline" | "attachment",
) {
  const storage = getClient();
  try {
    const url = await getSignedUrl(
      storage.client,
      new GetObjectCommand({
        Bucket: storage.bucket,
        Key: key,
        ResponseContentType: "application/pdf",
        ResponseContentDisposition: contentDisposition(mode, fileName),
        ResponseCacheControl: "private, no-store",
      }),
      { expiresIn: storage.signedUrlTtlSeconds },
    );

    return {
      url,
      expiresIn: storage.signedUrlTtlSeconds,
    };
  } catch {
    throw new StorageOperationError();
  }
}
