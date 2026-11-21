import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { MAX_RESUME_FILE_SIZE_BYTES, validateResumePdf } from "@/lib/resumes/pdf";

const validPdf = Buffer.from("%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\nstartxref\n0\n%%EOF");

function expectApiError(action: () => unknown, code: string) {
  try {
    action();
    throw new Error("Expected validation to fail.");
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe(code);
  }
}

describe("resume PDF validation", () => {
  it("accepts a PDF with the required extension, MIME type, signature, and trailer", () => {
    expect(validateResumePdf("resume.pdf", "application/pdf", validPdf)).toBe(validPdf);
  });

  it("rejects a non-PDF extension and incorrect declared MIME type", () => {
    expectApiError(() => validateResumePdf("resume.txt", "application/pdf", validPdf), "INVALID_FILE_TYPE");
    expectApiError(() => validateResumePdf("resume.pdf", "text/plain", validPdf), "INVALID_MIME_TYPE");
  });

  it("rejects missing signatures, incomplete documents, and active content", () => {
    expectApiError(
      () => validateResumePdf("resume.pdf", "application/pdf", Buffer.from("not a PDF")),
      "INVALID_PDF",
    );
    expectApiError(
      () => validateResumePdf("resume.pdf", "application/pdf", Buffer.from("%PDF-1.7\ntruncated")),
      "INVALID_PDF",
    );
    expectApiError(
      () =>
        validateResumePdf(
          "resume.pdf",
          "application/pdf",
          Buffer.from("%PDF-1.7\n/OpenAction\nstartxref\n0\n%%EOF"),
        ),
      "SUSPICIOUS_PDF",
    );
  });

  it("rejects empty and oversized files", () => {
    expectApiError(() => validateResumePdf("resume.pdf", "application/pdf", Buffer.alloc(0)), "EMPTY_FILE");
    expectApiError(
      () =>
        validateResumePdf(
          "resume.pdf",
          "application/pdf",
          Buffer.alloc(MAX_RESUME_FILE_SIZE_BYTES + 1),
        ),
      "FILE_TOO_LARGE",
    );
  });
});
