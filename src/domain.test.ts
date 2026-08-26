import { describe, expect, it } from 'vitest';
import type { AppState, InvoiceLine } from './domain';
import { calculateInvoice, elapsedMinutes, financialSummary, partyFromClient, partyFromSettings, validateInvoice } from './domain';
import { emptyState, normalizeState } from './storage';

describe('calculateInvoice', () => {
  it('normalizes lines and calculates tax without floating point leakage', () => {
    const lines: InvoiceLine[] = [
      { id: '1', description: 'Consulting', quantity: 2.5, unit: 'hours', rate: 40, amount: 0 },
      { id: '2', description: 'Hosting', quantity: 1, unit: 'service', rate: 19.99, amount: 0 },
    ];
    expect(calculateInvoice(lines, 21)).toMatchObject({ subtotal: 119.99, taxAmount: 25.2, total: 145.19 });
  });
});

describe('financialSummary', () => {
  it('reserves against income less deductible expenses', () => {
    const state: AppState = {
      ...emptyState(),
      transactions: [
        { id: '1', type: 'income', amount: 1000, category: 'Services', description: 'Paid', date: '2026-08-01', deductible: false },
        { id: '2', type: 'expense', amount: 100, category: 'Software', description: 'Tools', date: '2026-08-02', deductible: true },
        { id: '3', type: 'expense', amount: 50, category: 'Personal', description: 'Non deductible', date: '2026-08-03', deductible: false },
      ],
      settings: { ...emptyState().settings, taxReserveRate: 30 },
    };
    expect(financialSummary(state)).toMatchObject({ income: 1000, expenses: 150, reserve: 270, safeToSpend: 580 });
  });
});

describe('elapsedMinutes', () => {
  it('adds elapsed timer minutes to stored minutes', () => {
    expect(elapsedMinutes({
      id: '1', clientId: '', title: 'Task', description: '', status: 'active', rate: 10,
      minutes: 15, startedAt: '2026-08-01T10:00:00.000Z', invoiceId: null, createdAt: '2026-08-01T09:00:00.000Z',
    }, new Date('2026-08-01T10:45:00.000Z').getTime())).toBe(60);
  });
});

describe('invoice safeguards', () => {
  it('reports missing legal and payment details before sending', () => {
    const state = emptyState();
    const client = { id: 'c1', name: 'Ābele SIA', registrationNumber: '', vatNumber: '', email: '', phone: '', address: '', postalCode: '', country: 'Latvia', createdAt: '2026-08-01' };
    expect(validateInvoice({
      id: 'i1', number: 'INV-1', clientId: client.id, issueDate: '2026-08-01', dueDate: '2026-08-15',
      status: 'draft', currency: 'EUR', seller: partyFromSettings(state.settings), buyer: partyFromClient(client),
      lines: [{ id: 'l1', description: 'Konsultācija', quantity: 1, unit: 'stunda', rate: 50, amount: 50 }],
      subtotal: 50, taxRate: 0, taxAmount: 0, total: 50, paidAt: null, notes: '', createdAt: '2026-08-01',
    })).toEqual(expect.arrayContaining(['seller_name', 'seller_registration', 'seller_address', 'seller_iban', 'buyer_address']));
  });

  it('migrates a v1 backup without discarding invoices', () => {
    const migrated = normalizeState({
      schemaVersion: 1,
      clients: [{ id: 'c1', name: 'Lāčplēsis SIA', address: 'Rīga' }],
      workItems: [], transactions: [],
      settings: { businessName: 'SIA Pārdevējs', address: 'Rīga', registrationNumber: '1', iban: 'LV00TEST' },
      invoices: [{ id: 'i1', number: 'INV-1', clientId: 'c1', issueDate: '2026-08-01', dueDate: '2026-08-15', lines: [], total: 0 }],
    });
    expect(migrated).toMatchObject({ schemaVersion: 2, clients: [{ name: 'Lāčplēsis SIA' }], invoices: [{ buyer: { name: 'Lāčplēsis SIA' }, seller: { name: 'SIA Pārdevējs' } }] });
  });
});
