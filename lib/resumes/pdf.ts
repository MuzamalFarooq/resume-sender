import { z } from "zod";
import { ApiError } from "@/lib/api/errors";

export const MAX_RESUME_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const resumeFileNameSchema = z.string().trim().min(1).max(255);
const PDF_HEADER_PATTERN = /^%PDF-(?:1\.[0-7]|2\.0)/;
const ACTIVE_PDF_CONTENT_PATTERN =
  /\/(?:JavaScript|JS|Launch|OpenAction|EmbeddedFiles?|RichMedia|AA)\b/i;

export function decodeResumeFileName(value: string | null): string {
  if (!value || value.length > 1024) {
    throw new ApiError(400, "INVALID_FILE_NAME", "Choose a PDF with a valid file name.");
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    throw new ApiError(400, "INVALID_FILE_NAME", "Choose a PDF with a valid file name.");
  }

  const fileName = decoded.split(/[\\/]/).pop()?.replace(/[\u0000-\u001f\u007f]/g, "").trim() ?? "";
  const parsed = resumeFileNameSchema.safeParse(fileName);
  if (!parsed.success || !/\.pdf$/i.test(parsed.data)) {
    throw new ApiError(400, "INVALID_FILE_NAME", "Only PDF files with a .pdf extension are allowed.");
  }

  return parsed.data;
}

export function validateResumePdf(
  fileName: string,
  declaredContentType: string | null,
  bytes: Buffer,
  maxFileSizeBytes = MAX_RESUME_FILE_SIZE_BYTES,
) {
  if (!/\.pdf$/i.test(fileName)) {
    throw new ApiError(400, "INVALID_FILE_TYPE", "Only PDF files are allowed.");
  }

  if (declaredContentType?.split(";")[0].trim().toLowerCase() !== "application/pdf") {
    throw new ApiError(400, "INVALID_MIME_TYPE", "The file must be declared as a PDF.");
  }

  if (!bytes.length) {
    throw new ApiError(400, "EMPTY_FILE", "The selected PDF is empty.");
  }

  if (bytes.length > maxFileSizeBytes || bytes.length > MAX_RESUME_FILE_SIZE_BYTES) {
    throw new ApiError(413, "FILE_TOO_LARGE", "PDF files must be 5 MB or smaller.");
  }

  const header = bytes.subarray(0, Math.min(bytes.length, 1024)).toString("latin1");
  const headerOffset = header.indexOf("%PDF-");
  if (headerOffset < 0 || !PDF_HEADER_PATTERN.test(header.slice(headerOffset))) {
    throw new ApiError(400, "INVALID_PDF", "This file does not have a valid PDF signature.");
  }

  const tail = bytes.subarray(Math.max(0, bytes.length - 2048)).toString("latin1");
  if (!/startxref\s+\d+\s+%%EOF\s*$/.test(tail)) {
    throw new ApiError(400, "INVALID_PDF", "This PDF appears incomplete or malformed.");
  }

  if (ACTIVE_PDF_CONTENT_PATTERN.test(bytes.toString("latin1"))) {
    throw new ApiError(400, "SUSPICIOUS_PDF", "This PDF contains unsupported active content.");
  }

  return bytes;
}

export function safeResumeFileName(value: string) {
  const name = value
    .split(/[\\/]/)
    .pop()
    ?.replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/["\\;]/g, "_")
    .trim();

  return name && /\.pdf$/i.test(name) ? name.slice(0, 255) : "resume.pdf";
}

export function contentDisposition(mode: "inline" | "attachment", fileName: string) {
  const safeName = safeResumeFileName(fileName);
  const asciiName = safeName.replace(/[^\x20-\x7e]/g, "_");
  const encodedName = encodeURIComponent(safeName).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${mode}; filename="${asciiName}"; filename*=UTF-8''${encodedName}`;
}
