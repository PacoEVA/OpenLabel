import { z } from 'zod';

/**
 * Supported external data source types.
 */
export const DataSourceTypeSchema = z.enum(['csv', 'excel', 'sql', 'rest']);
export type DataSourceType = z.infer<typeof DataSourceTypeSchema>;

/**
 * Base properties required on every ExternalDataSource definition.
 */
export const BaseDataSourceSchema = z.object({
  id: z.string().uuid({ message: 'Data source id must be a valid UUID' }),
  name: z.string().min(1, { message: 'Data source name cannot be empty' }),
  type: DataSourceTypeSchema,
  enabled: z.boolean().default(true),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

// ==========================================
// 1. CSV Data Source Schema
// ==========================================
export const CsvDelimiterSchema = z.enum([',', ';', '\t', '|']);
export type CsvDelimiter = z.infer<typeof CsvDelimiterSchema>;

export const CsvDataSourceConfigSchema = z.object({
  filePath: z.string().min(1, { message: 'CSV file path cannot be empty' }),
  delimiter: CsvDelimiterSchema.default(','),
  hasHeader: z.boolean().default(true),
  encoding: z.enum(['utf-8', 'latin1']).default('utf-8'),
  skipEmptyLines: z.boolean().default(true),
});
export type CsvDataSourceConfig = z.infer<typeof CsvDataSourceConfigSchema>;
export type CsvDataSourceConfigInput = z.input<typeof CsvDataSourceConfigSchema>;

export const CsvDataSourceSchema = BaseDataSourceSchema.extend({
  type: z.literal('csv'),
  config: CsvDataSourceConfigSchema,
});
export type CsvDataSource = z.infer<typeof CsvDataSourceSchema>;

// ==========================================
// 2. Excel Data Source Schema
// ==========================================
export const ExcelDataSourceConfigSchema = z.object({
  filePath: z.string().min(1, { message: 'Excel file path cannot be empty' }),
  sheetName: z.string().optional(),
  headerRow: z.number().int().min(1, { message: 'Header row must be >= 1' }).default(1),
});
export type ExcelDataSourceConfig = z.infer<typeof ExcelDataSourceConfigSchema>;
export type ExcelDataSourceConfigInput = z.input<typeof ExcelDataSourceConfigSchema>;

export const ExcelDataSourceSchema = BaseDataSourceSchema.extend({
  type: z.literal('excel'),
  config: ExcelDataSourceConfigSchema,
});
export type ExcelDataSource = z.infer<typeof ExcelDataSourceSchema>;

// ==========================================
// 3. SQL Data Source Schema
// ==========================================
export const SqlEngineSchema = z.enum(['mssql', 'postgres', 'mysql']);
export type SqlEngine = z.infer<typeof SqlEngineSchema>;

export const SqlDataSourceConfigSchema = z
  .object({
    engine: SqlEngineSchema.default('mssql'),
    host: z.string().min(1, { message: 'Database host cannot be empty' }),
    port: z.number().int().min(1).max(65535).default(1433),
    database: z.string().min(1, { message: 'Database name cannot be empty' }),
    username: z.string().min(1, { message: 'Username cannot be empty' }),
    // SECURITY CRITICAL: Passwords are NEVER stored here! Only a secure vault reference.
    credentialRef: z.string().uuid({ message: 'credentialRef must be a valid UUID' }).optional(),
    queryMode: z.enum(['table', 'custom_select']).default('table'),
    tableName: z.string().optional(),
    customQuery: z.string().optional(),
    timeoutMs: z.number().int().min(1000).max(120000).default(30000),
    encrypt: z.boolean().default(true),
    trustServerCertificate: z.boolean().default(false),
  })
  .refine(
    (cfg) => {
      if (cfg.queryMode === 'table' && (!cfg.tableName || cfg.tableName.trim() === '')) {
        return false;
      }
      if (cfg.queryMode === 'custom_select' && (!cfg.customQuery || cfg.customQuery.trim() === '')) {
        return false;
      }
      return true;
    },
    { message: 'Table name is required for table mode; Custom query is required for custom_select mode' }
  );
export type SqlDataSourceConfig = z.infer<typeof SqlDataSourceConfigSchema>;
export type SqlDataSourceConfigInput = z.input<typeof SqlDataSourceConfigSchema>;

export const SqlDataSourceSchema = BaseDataSourceSchema.extend({
  type: z.literal('sql'),
  config: SqlDataSourceConfigSchema,
});
export type SqlDataSource = z.infer<typeof SqlDataSourceSchema>;

// ==========================================
// 4. REST Data Source Schema
// ==========================================
export const RestMethodSchema = z.enum(['GET', 'POST']);
export type RestMethod = z.infer<typeof RestMethodSchema>;

export const RestHeaderSchema = z.object({
  name: z.string().min(1, { message: 'Header name cannot be empty' }),
  value: z.string(),
});
export type RestHeader = z.infer<typeof RestHeaderSchema>;

export const RestDataSourceConfigSchema = z.object({
  url: z
    .string()
    .url({ message: 'REST URL must be a valid URL' })
    .refine(
      (url) => url.startsWith('http://') || url.startsWith('https://'),
      { message: 'REST URL must use http or https protocol' }
    ),
  method: RestMethodSchema.default('GET'),
  headers: z.array(RestHeaderSchema).default([]),
  // SECURITY CRITICAL: Tokens/Auth headers are NEVER stored in plaintext!
  credentialRef: z.string().uuid({ message: 'credentialRef must be a valid UUID' }).optional(),
  body: z.string().optional(),
  dataPath: z.string().optional(),
  timeoutMs: z.number().int().min(1000).max(60000).default(10000),
});
export type RestDataSourceConfig = z.infer<typeof RestDataSourceConfigSchema>;
export type RestDataSourceConfigInput = z.input<typeof RestDataSourceConfigSchema>;

export const RestDataSourceSchema = BaseDataSourceSchema.extend({
  type: z.literal('rest'),
  config: RestDataSourceConfigSchema,
});
export type RestDataSource = z.infer<typeof RestDataSourceSchema>;

// ==========================================
// Discriminated Union of all External Data Sources
// ==========================================
export const ExternalDataSourceSchema = z.discriminatedUnion('type', [
  CsvDataSourceSchema,
  ExcelDataSourceSchema,
  SqlDataSourceSchema,
  RestDataSourceSchema,
]);

export type ExternalDataSource = z.infer<typeof ExternalDataSourceSchema>;
