import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { TemplatesService } from '../../../src/main/documents/templates.service';
import type { LabelDocument } from '../../../src/core/schemas/label.schema';

describe('TemplatesService (Bloque 10)', () => {
  let tempDir: string;
  let service: TemplatesService;

  const sampleDoc: LabelDocument = {
    version: '1.0.0',
    meta: {
      title: 'My Custom Inventory Template',
      author: 'Tester',
      created: '2026-09-12T10:00:00.000Z',
    },
    dimensions: {
      width: 70,
      height: 40,
      unit: 'mm',
      dpi: 203,
    },
    elements: [],
  };

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openlabels-templates-'));
    service = new TemplatesService(tempDir);
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  it('lists built-in templates when user templates directory is empty', async () => {
    const res = await service.listTemplates();
    expect(res.builtIn.length).toBeGreaterThanOrEqual(3);
    expect(res.user.length).toBe(0);

    const shipping = res.builtIn.find((t) => t.id === 'shipping-100x50');
    expect(shipping).toBeDefined();
    expect(shipping?.dimensions.width).toBe(100);
  });

  it('saves and lists user templates', async () => {
    const saveRes = await service.saveUserTemplate('Inventory-70x40', sampleDoc);
    expect(saveRes.success).toBe(true);
    expect(saveRes.templateId).toBe('user-Inventory-70x40');

    const listRes = await service.listTemplates();
    expect(listRes.user.length).toBe(1);
    expect(listRes.user[0].id).toBe('user-Inventory-70x40');
    expect(listRes.user[0].name).toBe('My Custom Inventory Template');
    expect(listRes.user[0].dimensions.width).toBe(70);
  });

  it('retrieves full template document for both built-in and user templates', async () => {
    // 1. Built-in
    const builtInDoc = await service.getTemplateDocument('product-50x30', true);
    expect(builtInDoc).toBeDefined();
    expect(builtInDoc?.dimensions.width).toBe(50);

    // 2. User
    await service.saveUserTemplate('My-Tpl', sampleDoc);
    const userDoc = await service.getTemplateDocument('user-My-Tpl', false);
    expect(userDoc).toBeDefined();
    expect(userDoc?.meta.title).toBe('My Custom Inventory Template');
  });

  it('rejects saving empty template name', async () => {
    const saveRes = await service.saveUserTemplate('   ', sampleDoc);
    expect(saveRes.success).toBe(false);
    expect(saveRes.errors).toBeDefined();
  });
});
