import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { RestDataSourceAdapter } from '../../../src/main/data-sources/adapters/rest.adapter';

describe('RestDataSourceAdapter (Bloque 8)', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', `http://${req.headers.host}`);

      if (url.pathname === '/api/items' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify([{ id: 1, name: 'Item A' }, { id: 2, name: 'Item B' }]));
        return;
      }

      if (url.pathname === '/api/search' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          const parsed = JSON.parse(body || '{}');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify([{ query: parsed.query, resultCount: 42 }]));
        });
        return;
      }

      if (url.pathname === '/api/nested' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            status: 'ok',
            data: {
              items: [
                { id: '101', customer: { name: 'Acme Corp', code: 'ACM' }, active: true },
                { id: '102', customer: { name: 'Beta Ltd', code: 'BET' }, active: false },
              ],
            },
          })
        );
        return;
      }

      if (url.pathname === '/api/error400') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Bad Request' }));
        return;
      }

      if (url.pathname === '/api/error500') {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
        return;
      }

      if (url.pathname === '/api/timeout') {
        // Delay response to trigger timeout
        setTimeout(() => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify([{ delayed: true }]));
        }, 1150);
        return;
      }

      if (url.pathname === '/api/invalid-json') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html>Not JSON</html>');
        return;
      }

      if (url.pathname === '/api/many-rows') {
        const rows = Array.from({ length: 50 }, (_, i) => ({ id: i + 1, title: `Row ${i + 1}` }));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(rows));
        return;
      }

      if (url.pathname === '/api/auth') {
        const auth = req.headers['authorization'];
        if (auth && auth.includes('secret-token-12345')) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify([{ authenticated: true }]));
        } else {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Unauthorized' }));
        }
        return;
      }

      res.writeHead(404);
      res.end('Not Found');
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('performs GET request and parses array of records', async () => {
    const adapter = new RestDataSourceAdapter({
      url: `${baseUrl}/api/items`,
      method: 'GET',
    });

    const dataset = await adapter.fetchPreview();
    expect(dataset.rows).toHaveLength(2);
    expect(dataset.rows[0]).toEqual({ id: 1, name: 'Item A' });
    expect(dataset.columns.map((c) => c.key)).toContain('id');
    expect(dataset.columns.map((c) => c.key)).toContain('name');
  });

  it('performs POST request with JSON payload', async () => {
    const adapter = new RestDataSourceAdapter({
      url: `${baseUrl}/api/search`,
      method: 'POST',
      body: JSON.stringify({ query: 'screws' }),
    });

    const dataset = await adapter.fetchPreview();
    expect(dataset.rows).toHaveLength(1);
    expect(dataset.rows[0].query).toBe('screws');
    expect(dataset.rows[0].resultCount).toBe(42);
  });

  it('extracts nested array using dataPath and performs controlled object flattening', async () => {
    const adapter = new RestDataSourceAdapter({
      url: `${baseUrl}/api/nested`,
      method: 'GET',
      dataPath: 'data.items',
    });

    const dataset = await adapter.fetchPreview();
    expect(dataset.rows).toHaveLength(2);

    // Verifies controlled flattening: customer.name and customer.code
    expect(dataset.rows[0]['customer.name']).toBe('Acme Corp');
    expect(dataset.rows[0]['customer.code']).toBe('ACM');
    expect(dataset.rows[0]['active']).toBe(true);

    expect(dataset.columns.map((c) => c.key)).toContain('customer.name');
    expect(dataset.columns.map((c) => c.key)).toContain('customer.code');
  });

  it('handles 400 and 500 HTTP errors gracefully', async () => {
    const adapter400 = new RestDataSourceAdapter({
      url: `${baseUrl}/api/error400`,
      method: 'GET',
    });
    await expect(adapter400.fetchPreview()).rejects.toThrow(/HTTP error 400/);

    const adapter500 = new RestDataSourceAdapter({
      url: `${baseUrl}/api/error500`,
      method: 'GET',
    });
    await expect(adapter500.fetchPreview()).rejects.toThrow(/HTTP error 500/);
  });

  it('enforces request timeout', async () => {
    const adapter = new RestDataSourceAdapter({
      url: `${baseUrl}/api/timeout`,
      method: 'GET',
      timeoutMs: 1000,
    });

    await expect(adapter.fetchPreview()).rejects.toThrow(/timed out/i);
  });

  it('detects and rejects invalid JSON responses', async () => {
    const adapter = new RestDataSourceAdapter({
      url: `${baseUrl}/api/invalid-json`,
      method: 'GET',
    });

    await expect(adapter.fetchPreview()).rejects.toThrow(/not valid JSON/i);
  });

  it('enforces row limits and sets truncated: true', async () => {
    const adapter = new RestDataSourceAdapter({
      url: `${baseUrl}/api/many-rows`,
      method: 'GET',
    });

    const dataset = await adapter.fetchPreview(10);
    expect(dataset.rows).toHaveLength(10);
    expect(dataset.totalRows).toBe(50);
    expect(dataset.truncated).toBe(true);
  });

  it('injects credentials into Authorization header and redacts secrets on errors', async () => {
    const secret = 'secret-token-12345';
    const adapter = new RestDataSourceAdapter(
      {
        url: `${baseUrl}/api/auth`,
        method: 'GET',
      },
      secret
    );

    const dataset = await adapter.fetchPreview();
    expect(dataset.rows[0].authenticated).toBe(true);

    // Test error redaction when network/fetch error contains the secret
    const failingAdapter = new RestDataSourceAdapter(
      {
        url: `http://non-existent-domain-${secret}.internal/api/data`,
        method: 'GET',
      },
      secret
    );

    try {
      await failingAdapter.fetchPreview();
      expect.unreachable('Should have failed');
    } catch (err: unknown) {
      const msg = String(err);
      expect(msg).not.toContain(secret);
      expect(msg).toContain('******');
    }
  });

  it('strictly rejects forbidden URL schemes (file:, javascript:, ftp:)', () => {
    const unsafeUrls = ['file:///etc/passwd', 'javascript:alert(1)', 'ftp://server.com'];
    for (const url of unsafeUrls) {
      expect(() => new RestDataSourceAdapter({ url, method: 'GET' })).toThrow(
        /REST URL must use http or https protocol/
      );
    }
  });
});
