import { z } from "zod";

const emailAddress = z
  .string()
  .trim()
  .email("Enter a valid email address.")
  .transform((email) => email.toLowerCase());

const recruiterFields = z
  .object({
    name: z.string().trim().min(1).max(120),
    email: emailAddress,
    company: z.string().trim().max(120),
    jobTitle: z.string().trim().max(120),
  })
  .strict();

export const recruiterCreateSchema = recruiterFields.extend({
  company: recruiterFields.shape.company.default(""),
  jobTitle: recruiterFields.shape.jobTitle.default(""),
});

export const recruiterUpdateSchema = recruiterFields
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Provide at least one field to update.");

export const recruiterImportSchema = z
  .object({
    recruiters: z.array(recruiterCreateSchema).max(1000),
  })
  .strict();

export const templateCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    subject: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(20_000),
  })
  .strict();

export const templateUpdateSchema = templateCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Provide at least one field to update.");

export const templateImportSchema = z
  .object({
    templates: z.array(templateCreateSchema).max(100),
  })
  .strict();

export const resumeRenameSchema = z
  .object({
    displayName: z.string().trim().min(1).max(160).refine(
      (value) => !/[\u0000-\u001f\u007f]/.test(value),
      "The display name cannot contain control characters.",
    ),
  })
  .strict();

export const resumeIdSchema = z.string().trim().min(1).max(64);
