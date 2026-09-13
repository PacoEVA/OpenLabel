import { z } from 'zod';

/**
 * Valid thermal printer resolutions for hardware printing (DPI).
 */
export const PrinterDpiSchema = z.union([
  z.literal(203),
  z.literal(300),
  z.literal(600),
]);
export type PrinterDpi = z.infer<typeof PrinterDpiSchema>;

/**
 * TCP Raw Socket connection configuration (e.g. Zebra Net card, Port 9100).
 */
export const TcpConnectionSchema = z.object({
  type: z.literal('tcp'),
  host: z
    .string()
    .min(1, 'Host cannot be empty')
    .regex(/^[a-zA-Z0-9.-]+$/, 'Host must be a valid hostname or IP address'),
  port: z
    .number()
    .int()
    .min(1, 'Port must be >= 1')
    .max(65535, 'Port must be <= 65535')
    .default(9100),
  timeoutMs: z
    .number()
    .int()
    .min(500, 'Timeout must be at least 500ms')
    .max(60000, 'Timeout must be at most 60000ms')
    .default(5000),
});
export type TcpConnection = z.infer<typeof TcpConnectionSchema>;

/**
 * OS System Printer / Spooler configuration (e.g. Windows spooler, CUPS).
 */
export const SystemConnectionSchema = z.object({
  type: z.literal('system'),
  printerName: z.string().min(1, 'Printer name cannot be empty'),
});
export type SystemConnection = z.infer<typeof SystemConnectionSchema>;

/**
 * Union of supported connection types.
 */
export const PrinterConnectionSchema = z.discriminatedUnion('type', [
  TcpConnectionSchema,
  SystemConnectionSchema,
]);
export type PrinterConnection = z.infer<typeof PrinterConnectionSchema>;

/**
 * Target printer command language.
 */
export const PrinterLanguageSchema = z.enum(['zpl', 'pdf']);
export type PrinterLanguage = z.infer<typeof PrinterLanguageSchema>;

/**
 * Complete Printer Profile schema.
 */
export const PrinterProfileSchema = z
  .object({
    id: z.string().uuid('Profile ID must be a valid UUID'),
    name: z.string().min(1, 'Profile name is required').max(100),
    connection: PrinterConnectionSchema,
    language: PrinterLanguageSchema,
    dpi: PrinterDpiSchema.optional(),
    enabled: z.boolean().default(true),
    createdAt: z.string().datetime().optional(),
    updatedAt: z.string().datetime().optional(),
  })
  .refine(
    (profile) => {
      // If language is ZPL, hardware DPI is strictly required
      if (profile.language === 'zpl') {
        return profile.dpi !== undefined;
      }
      return true;
    },
    {
      message: 'Hardware DPI (203, 300, or 600) is required for ZPL printer profiles',
      path: ['dpi'],
    }
  );

export type PrinterProfile = z.infer<typeof PrinterProfileSchema>;
