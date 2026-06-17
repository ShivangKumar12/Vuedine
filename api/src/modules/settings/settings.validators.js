import { z } from 'zod';

export const tenantSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(120).optional(),
    legalName: z.string().max(160).optional().nullable(),
    type: z.string().max(40).optional(),
    gstin: z.string().max(40).optional().nullable(),
    pan: z.string().max(20).optional().nullable(),
    fssai: z.string().max(40).optional().nullable(),
    description: z.string().max(1000).optional().nullable(),
    logoUrl: z.string().url().max(500).optional().nullable(),
    bannerUrl: z.string().url().max(500).optional().nullable(),
    contactEmail: z.string().email().max(200).optional().nullable(),
    contactPhone: z.string().max(40).optional().nullable(),
    invoicePrefix: z.string().trim().min(1).max(10).optional(),
    invoiceSequence: z.coerce.number().int().min(1).max(10_000_000).optional(),
    // Receipt / tax extras (persisted in taxConfig JSON)
    receiptFooter: z.string().max(400).optional().nullable(),
    roundOff: z.boolean().optional(),
    logoOnReceipt: z.boolean().optional(),
    serviceChargeEnabled: z.boolean().optional(),
    serviceChargePct: z.coerce.number().min(0).max(50).optional(),
    taxInclusive: z.boolean().optional(),
    igstInterState: z.boolean().optional(),
  }),
});

export const brandingSchema = z.object({
  body: z.object({
    brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex color').optional(),
    brandTheme: z.enum(['light', 'dark']).optional(),
    customDomain: z
      .string()
      .max(120)
      .regex(/^[a-z0-9.-]*$/, 'Invalid domain')
      .optional()
      .nullable(),
    logoUrl: z.string().url().max(500).optional().nullable(),
    bannerUrl: z.string().url().max(500).optional().nullable(),
  }),
});

export const localizationSchema = z.object({
  body: z.object({
    currency: z.string().min(2).max(8).optional(),
    timezone: z.string().max(60).optional(),
    locale: z.string().max(20).optional(),
    numberLocale: z.string().max(20).optional(),
    weekStart: z.enum(['MONDAY', 'SUNDAY', 'SATURDAY']).optional(),
    weightUnit: z.string().max(10).optional(),
  }),
});

export const anonymizeSchema = z.object({
  body: z.object({
    confirm: z.literal(true),
  }),
});
