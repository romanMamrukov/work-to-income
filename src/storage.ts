import type { AppState } from './domain';
import { STORAGE_KEY, addDays, isoDate } from './domain';

export const emptyState = (): AppState => ({
  schemaVersion: 1,
  clients: [],
  workItems: [],
  invoices: [],
  transactions: [],
  settings: {
    businessName: '',
    registrationNumber: '',
    vatNumber: '',
    address: '',
    email: '',
    phone: '',
    bankName: '',
    iban: '',
    swift: '',
    invoicePrefix: 'INV',
    nextInvoiceNumber: 1,
    paymentTermsDays: 14,
    defaultHourlyRate: 35,
    taxReserveRate: 30,
    currency: 'EUR',
    invoiceNotes: 'Thank you for your business.',
  },
});

export const demoState = (): AppState => {
  const today = isoDate();
  return {
    ...emptyState(),
    clients: [
      {
        id: 'client_north', name: 'North Studio SIA', registrationNumber: '40203000001', vatNumber: '',
        email: 'finance@northstudio.example', phone: '+371 20000001', address: 'Riga, Latvia', createdAt: new Date().toISOString(),
      },
      {
        id: 'client_river', name: 'Riverline Consulting', registrationNumber: '', vatNumber: '',
        email: 'hello@riverline.example', phone: '+371 20000002', address: 'Jurmala, Latvia', createdAt: new Date().toISOString(),
      },
    ],
    workItems: [
      {
        id: 'work_dashboard', clientId: 'client_north', title: 'Analytics dashboard refinement',
        description: 'Responsive dashboard and data export', status: 'done', rate: 45, minutes: 390,
        startedAt: null, invoiceId: null, createdAt: new Date().toISOString(),
      },
      {
        id: 'work_support', clientId: 'client_river', title: 'Infrastructure support',
        description: 'Monthly maintenance and incident review', status: 'planned', rate: 40, minutes: 90,
        startedAt: null, invoiceId: null, createdAt: new Date().toISOString(),
      },
    ],
    invoices: [
      {
        id: 'invoice_demo', number: 'INV-0001', clientId: 'client_river', issueDate: today,
        dueDate: addDays(today, 14), status: 'sent', currency: 'EUR',
        lines: [{ id: 'line_demo', description: 'Technical consultation', quantity: 3, unit: 'hours', rate: 40, amount: 120 }],
        subtotal: 120, taxRate: 0, taxAmount: 0, total: 120, paidAt: null,
        notes: 'Payment due within 14 days.', createdAt: new Date().toISOString(),
      },
    ],
    transactions: [
      { id: 'tx_income', type: 'income', amount: 980, category: 'Services', description: 'Website delivery', date: today, deductible: false },
      { id: 'tx_expense', type: 'expense', amount: 74, category: 'Software', description: 'Business tools', date: today, deductible: true },
    ],
    settings: {
      ...emptyState().settings,
      businessName: 'Your Freelance Business',
      email: 'you@example.com',
      address: 'Riga, Latvia',
      iban: 'LV00BANK0000000000000',
      nextInvoiceNumber: 2,
    },
  };
};

const isState = (value: unknown): value is AppState => {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<AppState>;
  return state.schemaVersion === 1
    && Array.isArray(state.clients)
    && Array.isArray(state.workItems)
    && Array.isArray(state.invoices)
    && Array.isArray(state.transactions)
    && Boolean(state.settings);
};

export const loadState = (): AppState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return demoState();
    const parsed: unknown = JSON.parse(raw);
    return isState(parsed) ? parsed : demoState();
  } catch {
    return demoState();
  }
};

export const saveState = (state: AppState) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const parseBackup = (raw: string): AppState => {
  const parsed: unknown = JSON.parse(raw);
  if (!isState(parsed)) throw new Error('This file is not a valid Work to Income v1 backup.');
  return parsed;
};

export const downloadBackup = (state: AppState) => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `work-to-income-backup-${isoDate()}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
};
