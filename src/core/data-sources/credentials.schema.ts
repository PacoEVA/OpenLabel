import { z } from 'zod';

export const CredentialTypeSchema = z.enum([
  'password',
  'bearer_token',
  'api_key',
  'basic_auth',
  'custom_header',
]);
export type CredentialType = z.infer<typeof CredentialTypeSchema>;

/**
 * Public metadata safe to expose to the renderer or serialize in documents.
 * NEVER contains plaintext secrets, keys, or tokens.
 */
export const CredentialMetadataSchema = z.object({
  id: z.string().uuid({ message: 'Credential ID must be a valid UUID' }),
  name: z.string().min(1, { message: 'Credential name cannot be empty' }),
  type: CredentialTypeSchema,
  configured: z.literal(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CredentialMetadata = z.infer<typeof CredentialMetadataSchema>;

/**
 * Payload sent from renderer to main when configuring/updating a secret.
 * The secret string is immediately encrypted and persisted to disk; it is never echoed back.
 */
export const SetCredentialPayloadSchema = z.object({
  id: z.string().uuid().optional(), // if omitted, a new UUID is generated
  name: z.string().min(1, { message: 'Credential name cannot be empty' }),
  type: CredentialTypeSchema,
  secret: z.string().min(1, { message: 'Secret value cannot be empty' }),
});
export type SetCredentialPayload = z.infer<typeof SetCredentialPayloadSchema>;
