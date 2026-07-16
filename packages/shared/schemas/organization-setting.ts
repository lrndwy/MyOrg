import { z } from "zod";

export const CreateOrganizationSettingSchema = z.object({
  webName: z.string(),
  logoUrl: z.string(),
  iconUrl: z.string(),
  theme: z.string(),
  allowSelfRegister: z.boolean(),
  allowCrossDivisionEventsView: z.boolean(),
  letterheadTemplateUrl: z.string(),
  letterPlace: z.string(),
  signatureIdLabel: z.string(),
  version: z.number().int(),
});

export const UpdateOrganizationSettingSchema = z.object({
  webName: z.string().optional(),
  logoUrl: z.string().optional(),
  iconUrl: z.string().optional(),
  theme: z.string().optional(),
  allowSelfRegister: z.boolean().optional(),
  allowCrossDivisionEventsView: z.boolean().optional(),
  letterheadTemplateUrl: z.string().optional(),
  letterPlace: z.string().optional(),
  signatureIdLabel: z.string().optional(),
  version: z.number().int().optional(),
});

export type CreateOrganizationSettingInput = z.infer<typeof CreateOrganizationSettingSchema>;
export type UpdateOrganizationSettingInput = z.infer<typeof UpdateOrganizationSettingSchema>;
