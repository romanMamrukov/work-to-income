import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { demoState } from './storage';
import { createInvoicePdf } from './pdf';

describe('invoice PDF', () => {
  it('creates a populated Unicode PDF with invoice data', async () => {
    const font = readFileSync('public/fonts/DejaVuSans.ttf').toString('base64');
    const invoice = {
      ...demoState().invoices[0],
      number: 'RĒĶINS-0001',
      lines: [
        { id: 'hours', description: 'Tehniskā konsultācija', quantity: 2.5, unit: 'hours', rate: 40, amount: 100 },
        { id: 'items', description: 'Rezerves daļa', quantity: 3, unit: 'items', rate: 20, amount: 60 },
      ],
      subtotal: 160,
      total: 160,
    };

    const doc = await createInvoicePdf(invoice, 'lv', font);
    const output = doc.output('arraybuffer');

    expect(doc.getNumberOfPages()).toBe(1);
    expect(output.byteLength).toBeGreaterThan(10_000);
  });
});
