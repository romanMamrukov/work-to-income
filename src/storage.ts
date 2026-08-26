import type { AppState, Client, Invoice, InvoiceParty, Settings } from './domain';
import { STORAGE_KEY, addDays, isoDate, partyFromClient, partyFromSettings } from './domain';

const now = () => new Date().toISOString();

const defaultSettings = (): Settings => ({
  language: 'en', businessName: '', registrationNumber: '', vatNumber: '', address: '', postalCode: '',
  country: 'Latvia', email: '', phone: '', bankName: '', iban: '', swift: '', invoicePrefix: 'INV',
  nextInvoiceNumber: 1, paymentTermsDays: 14, defaultHourlyRate: 35, taxReserveRate: 30,
  currency: 'EUR', invoiceNotes: 'Thank you for your business.', backupReminderDays: 7,
});

export const emptyState = (): AppState => ({
  schemaVersion: 2,
  clients: [], workItems: [], invoices: [], transactions: [],
  settings: defaultSettings(),
  meta: { createdAt: now(), lastBackupAt: null, backupReminderDismissedAt: null },
});

export const demoState = (): AppState => {
  const today = isoDate();
  const settings: Settings = {
    ...defaultSettings(), businessName: 'Your Freelance Business', registrationNumber: '40000000000',
    address: 'Brīvības iela 1', postalCode: 'LV-1010', country: 'Latvia', email: 'you@example.com',
    phone: '+371 20000000', bankName: 'Example Bank', iban: 'LV00BANK0000000000000', swift: 'BANKLV2X',
    nextInvoiceNumber: 2,
  };
  const clients: Client[] = [
    { id: 'client_north', name: 'North Studio SIA', registrationNumber: '40203000001', vatNumber: '',
      email: 'finance@northstudio.example', phone: '+371 20000001', address: 'Elizabetes iela 10',
      postalCode: 'LV-1010', country: 'Latvia', createdAt: now() },
    { id: 'client_river', name: 'Riverline Consulting', registrationNumber: '40103000002', vatNumber: '',
      email: 'hello@riverline.example', phone: '+371 20000002', address: 'Jomas iela 20',
      postalCode: 'LV-2015', country: 'Latvia', createdAt: now() },
  ];
  return {
    ...emptyState(), settings, clients,
    workItems: [
      { id: 'work_dashboard', clientId: 'client_north', title: 'Analytics dashboard refinement',
        description: 'Responsive dashboard and data export', status: 'done', rate: 45, minutes: 390,
        startedAt: null, invoiceId: null, createdAt: now() },
      { id: 'work_support', clientId: 'client_river', title: 'Infrastructure support',
        description: 'Monthly maintenance and incident review', status: 'planned', rate: 40, minutes: 90,
        startedAt: null, invoiceId: null, createdAt: now() },
    ],
    invoices: [{
      id: 'invoice_demo', number: 'INV-0001', clientId: 'client_river', issueDate: today,
      dueDate: addDays(today, 14), status: 'sent', currency: 'EUR', seller: partyFromSettings(settings),
      buyer: partyFromClient(clients[1]),
      lines: [{ id: 'line_demo', description: 'Technical consultation', quantity: 3, unit: 'hours', rate: 40, amount: 120 }],
      subtotal: 120, taxRate: 0, taxAmount: 0, total: 120, paidAt: null,
      notes: 'Payment due within 14 days.', createdAt: now(),
    }],
    transactions: [
      { id: 'tx_income', type: 'income', amount: 980, category: 'Services', description: 'Website delivery', date: today, deductible: false },
      { id: 'tx_expense', type: 'expense', amount: 74, category: 'Software', description: 'Business tools', date: today, deductible: true },
    ],
  };
};

type LegacyState = Omit<Partial<AppState>, 'schemaVersion' | 'settings' | 'clients' | 'invoices'> & {
  schemaVersion?: number;
  settings?: Partial<Settings>;
  clients?: Array<Partial<Client> & Pick<Client, 'id' | 'name'>>;
  invoices?: Array<Partial<Invoice> & Pick<Invoice, 'id' | 'number' | 'clientId'>>;
};

const emptyParty = (): InvoiceParty => ({
  name: '', registrationNumber: '', vatNumber: '', email: '', phone: '', address: '', postalCode: '',
  country: '', bankName: '', iban: '', swift: '',
});

export const normalizeState = (value: unknown): AppState | null => {
  if (!value || typeof value !== 'object') return null;
  const source = value as LegacyState;
  if (![1, 2].includes(source.schemaVersion ?? 0) || !Array.isArray(source.clients)
    || !Array.isArray(source.workItems) || !Array.isArray(source.invoices)
    || !Array.isArray(source.transactions) || !source.settings) return null;
  const settings: Settings = { ...defaultSettings(), ...source.settings };
  const clients: Client[] = source.clients.map((client) => ({
    id: client.id, name: client.name, registrationNumber: client.registrationNumber ?? '',
    vatNumber: client.vatNumber ?? '', email: client.email ?? '', phone: client.phone ?? '',
    address: client.address ?? '', postalCode: client.postalCode ?? '', country: client.country ?? settings.country,
    createdAt: client.createdAt ?? now(),
  }));
  const invoices: Invoice[] = source.invoices.map((invoice) => {
    const client = clients.find((item) => item.id === invoice.clientId);
    const seller = { ...emptyParty(), ...partyFromSettings(settings), ...(invoice.seller ?? {}) };
    const buyer = { ...emptyParty(), ...(client ? partyFromClient(client) : {}), ...(invoice.buyer ?? {}) };
    return {
      id: invoice.id, number: invoice.number, clientId: invoice.clientId,
      issueDate: invoice.issueDate ?? isoDate(), dueDate: invoice.dueDate ?? isoDate(),
      status: invoice.status ?? 'draft', currency: invoice.currency ?? settings.currency,
      seller, buyer, lines: invoice.lines ?? [], subtotal: invoice.subtotal ?? 0, taxRate: invoice.taxRate ?? 0,
      taxAmount: invoice.taxAmount ?? 0, total: invoice.total ?? 0, paidAt: invoice.paidAt ?? null,
      notes: invoice.notes ?? '', createdAt: invoice.createdAt ?? now(),
    };
  });
  return {
    schemaVersion: 2, clients,
    workItems: source.workItems as AppState['workItems'], invoices,
    transactions: source.transactions as AppState['transactions'], settings,
    meta: {
      createdAt: source.meta?.createdAt ?? now(), lastBackupAt: source.meta?.lastBackupAt ?? null,
      backupReminderDismissedAt: source.meta?.backupReminderDismissedAt ?? null,
    },
  };
};

export const loadState = (): AppState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return demoState();
    return normalizeState(JSON.parse(raw)) ?? demoState();
  } catch { return demoState(); }
};

export const saveState = (state: AppState) => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

export const parseBackup = (raw: string): AppState => {
  const parsed = normalizeState(JSON.parse(raw));
  if (!parsed) throw new Error('This file is not a valid Work to Income backup.');
  return parsed;
};

export const downloadBackup = (state: AppState) => {
  const exported = { ...state, meta: { ...state.meta, lastBackupAt: now() } };
  const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `work-to-income-backup-${isoDate()}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
};
