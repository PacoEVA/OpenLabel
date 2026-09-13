import { describe, it, expect } from 'vitest';
import {
  BUILT_IN_TEMPLATES,
  cloneTemplate,
} from '../../../src/core/templates/built-in-templates';
import { LabelDocumentSchema } from '../../../src/core/schemas/label.schema';

describe('Built-in Templates & Safe Cloning (Bloque 10)', () => {
  it('all built-in templates are valid according to LabelDocumentSchema', () => {
    expect(BUILT_IN_TEMPLATES.length).toBeGreaterThanOrEqual(3);

    for (const t of BUILT_IN_TEMPLATES) {
      const validation = LabelDocumentSchema.safeParse(t.document);
      expect(validation.success).toBe(true);
      expect(t.isBuiltIn).toBe(true);
    }
  });

  it('contains standard industrial and retail templates', () => {
    const ids = BUILT_IN_TEMPLATES.map((t) => t.id);
    expect(ids).toContain('shipping-100x50');
    expect(ids).toContain('product-50x30');
    expect(ids).toContain('logistics-100x150');
  });

  it('cloneTemplate regenerates element UUIDs to guarantee distinct document identity', () => {
    const original = BUILT_IN_TEMPLATES[0].document;
    const cloned = cloneTemplate(original, 'My Custom Shipping Label');

    expect(cloned.meta.title).toBe('My Custom Shipping Label');
    expect(cloned.dimensions).toEqual(original.dimensions);
    expect(cloned.elements.length).toBe(original.elements.length);

    // Verify all element UUIDs are fresh
    for (let i = 0; i < original.elements.length; i++) {
      expect(cloned.elements[i].id).not.toBe(original.elements[i].id);
      expect(cloned.elements[i].type).toBe(original.elements[i].type);
    }

    // Verify original template is untouched
    expect(BUILT_IN_TEMPLATES[0].document.meta.title).toBe(original.meta.title);
  });
});
