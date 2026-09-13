import { describe, it, expect } from 'vitest';
import { SqlDataSourceAdapter } from '../../../src/main/data-sources/adapters/sql.adapter';
import { MockSqlDriver } from '../../../src/main/data-sources/adapters/sql/mock-sql.driver';
import { validateReadOnlyQuery, sanitizeSqlErrorMessage } from '../../../src/main/data-sources/adapters/sql/sql-sanitizer';

describe('SqlDataSourceAdapter and Security (Bloque 7)', () => {
  const baseConfig = {
    engine: 'mssql' as const,
    host: 'db.internal',
    port: 1433,
    database: 'WarehouseDB',
    username: 'label_ro',
    timeoutMs: 5000,
    encrypt: true,
    trustServerCertificate: false,
  };

  describe('Connection & Testing', () => {
    it('reports successful connection when driver connects', async () => {
      const mockDriver = new MockSqlDriver();
      const adapter = new SqlDataSourceAdapter(
        { ...baseConfig, queryMode: 'table', tableName: 'Products' },
        mockDriver,
        'SuperSecretPassword123'
      );

      const res = await adapter.testConnection();
      expect(res.success).toBe(true);
      expect(res.message).toContain('Connected');
    });

    it('handles connection failure gracefully', async () => {
      const mockDriver = new MockSqlDriver();
      mockDriver.shouldFailConnect = true;
      mockDriver.connectErrorMessage = 'Network error connecting to SQL Server at db.internal';

      const adapter = new SqlDataSourceAdapter(
        { ...baseConfig, queryMode: 'table', tableName: 'Products' },
        mockDriver
      );

      const res = await adapter.testConnection();
      expect(res.success).toBe(false);
      expect(res.message).toContain('Network error');
    });
  });

  describe('Read-Only Query Validation (Security)', () => {
    it('accepts valid SELECT and CTE queries', () => {
      expect(validateReadOnlyQuery('SELECT id, name, price FROM Products WHERE active = 1').valid).toBe(true);
      expect(validateReadOnlyQuery('WITH Ranked AS (SELECT id, ROW_NUMBER() OVER (ORDER BY id) as rn FROM Items) SELECT * FROM Ranked').valid).toBe(true);
      expect(validateReadOnlyQuery('select * from "my_table"').valid).toBe(true);
    });

    it('strictly rejects forbidden SQL keywords (INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, EXEC)', () => {
      const dangerousQueries = [
        'DROP TABLE Products',
        'DELETE FROM Products WHERE id = 1',
        'UPDATE Products SET price = 0',
        'INSERT INTO Products (name) VALUES ("Hack")',
        'TRUNCATE TABLE Logs',
        'ALTER TABLE Users ADD admin int',
        'EXEC xp_cmdshell "dir"',
        'EXECUTE sp_help',
      ];

      for (const sql of dangerousQueries) {
        const res = validateReadOnlyQuery(sql);
        expect(res.valid).toBe(false);
        expect(res.error).toMatch(/forbidden|read-only/i);
      }
    });

    it('strictly rejects multiple statements separated by semicolon', () => {
      const multiStatements = [
        'SELECT * FROM Products; DROP TABLE Users',
        'SELECT 1; SELECT 2',
      ];

      for (const sql of multiStatements) {
        const res = validateReadOnlyQuery(sql);
        expect(res.valid).toBe(false);
        expect(res.error).toContain('Multiple SQL statements are strictly forbidden');
      }
    });

    it('allows semicolon inside string literals without false positive', () => {
      const queryWithStringSemicolon = "SELECT id, name FROM Products WHERE note = 'item;with;semicolon'";
      expect(validateReadOnlyQuery(queryWithStringSemicolon).valid).toBe(true);
    });
  });

  describe('Table Mode & Query Execution', () => {
    it('escapes table identifiers in table mode', async () => {
      const mockDriver = new MockSqlDriver();
      const adapter = new SqlDataSourceAdapter(
        { ...baseConfig, queryMode: 'table', tableName: 'Products Table' },
        mockDriver
      );

      await adapter.fetchPreview();
      expect(mockDriver.lastQuery).toBe('SELECT * FROM [Products Table]');
    });

    it('enforces row limit and reports truncated dataset', async () => {
      const mockDriver = new MockSqlDriver();
      mockDriver.mockRows = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
        { id: 3, name: 'Item 3' },
      ];

      const adapter = new SqlDataSourceAdapter(
        { ...baseConfig, queryMode: 'table', tableName: 'Items' },
        mockDriver
      );

      const dataset = await adapter.fetchPreview(2);
      expect(dataset.rows).toHaveLength(2);
      expect(dataset.truncated).toBe(true);
    });

    it('rejects forbidden custom query in fetchAll', async () => {
      const mockDriver = new MockSqlDriver();
      const adapter = new SqlDataSourceAdapter(
        {
          ...baseConfig,
          queryMode: 'custom_select',
          customQuery: 'DELETE FROM Production.Orders',
        },
        mockDriver
      );

      await expect(adapter.fetchAll()).rejects.toThrow(/forbidden|read-only/i);
    });
  });

  describe('Error Sanitization', () => {
    it('scrubs passwords and credentials from error messages', () => {
      const secret = 'P@ssw0rd999!';
      const leakedError = new Error(`Connection failed for user=admin password=${secret} on host db.internal`);
      const sanitized = sanitizeSqlErrorMessage(leakedError, secret);

      expect(sanitized).not.toContain(secret);
      expect(sanitized).toContain('******');
    });
  });
});
