import { describe, it, expect } from 'vitest';
import { getSystemPrinters } from '../../../src/main/printing/discovery/system-printers';

describe('System Printer Discovery (Bloque 6)', () => {
  it('maps raw printer info to normalized SystemPrinterInfo', async () => {
    const mockProvider = async () => [
      {
        name: 'HP_LaserJet_Pro',
        displayName: 'HP LaserJet Pro M404n (Office)',
        description: 'Network Laser Printer',
        isDefault: true,
        status: 0,
      },
      {
        name: 'Zebra_ZD421',
        displayName: '',
        isDefault: false,
      },
    ];

    const printers = await getSystemPrinters(mockProvider);

    expect(printers).toHaveLength(2);
    expect(printers[0]).toEqual({
      name: 'HP_LaserJet_Pro',
      displayName: 'HP LaserJet Pro M404n (Office)',
      description: 'Network Laser Printer',
      isDefault: true,
      status: 0,
    });

    // When displayName is empty, defaults to name
    expect(printers[1].displayName).toBe('Zebra_ZD421');
    expect(printers[1].isDefault).toBe(false);
  });

  it('handles provider errors gracefully returning empty list', async () => {
    const errorProvider = async () => {
      throw new Error('OS spooler service unavailable');
    };

    const printers = await getSystemPrinters(errorProvider);
    expect(printers).toEqual([]);
  });
});
