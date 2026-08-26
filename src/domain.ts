export type Page = 'overview' | 'invoices' | 'clients' | 'work' | 'money' | 'settings';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
export type WorkStatus = 'planned' | 'active' | 'done' | 'invoiced';
export type TransactionType = 'income' | 'expense';

export interface Client {
  id: string;
  name: string;
  registrationNumber: string;
  vatNumber: string;
  email: string;
  phone: string;
  address: string;
  createdAt: string;
}

export interface WorkItem {
  id: string;
  clientId: string;
  title: string;
  description: string;
  status: WorkStatus;
  rate: number;
  minutes: number;
  startedAt: string | null;
  invoiceId: string | null;
  createdAt: string;
}

export interface InvoiceLine {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
  workItemId?: string;
}

export interface Invoice {
  id: string;
  number: string;
  clientId: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  currency: string;
  lines: InvoiceLine[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  paidAt: string | null;
  notes: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  category: string;
  description: string;
  date: string;
  deductible: boolean;
  invoiceId?: string;
}

export interface Settings {
  businessName: string;
  registrationNumber: string;
  vatNumber: string;
  address: string;
  email: string;
  phone: string;
  bankName: string;
  iban: string;
  swift: string;
  invoicePrefix: string;
  nextInvoiceNumber: number;
  paymentTermsDays: number;
  defaultHourlyRate: number;
  taxReserveRate: number;
  currency: string;
  invoiceNotes: string;
}

export interface AppState {
  schemaVersion: 1;
  clients: Client[];
  workItems: WorkItem[];
  invoices: Invoice[];
  transactions: Transaction[];
  settings: Settings;
}

export const STORAGE_KEY = 'work-to-income:v1';

export const createId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;

export const isoDate = (date = new Date()) => date.toISOString().slice(0, 10);

export const addDays = (date: string, days: number) => {
  const result = new Date(`${date}T12:00:00`);
  result.setDate(result.getDate() + days);
  return isoDate(result);
};

export const roundMoney = (value: number) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export const calculateInvoice = (lines: InvoiceLine[], taxRate: number) => {
  const normalizedLines = lines.map((line) => ({
    ...line,
    quantity: Math.max(0, Number(line.quantity) || 0),
    rate: Math.max(0, Number(line.rate) || 0),
    amount: roundMoney(Math.max(0, Number(line.quantity) || 0) * Math.max(0, Number(line.rate) || 0)),
  }));
  const subtotal = roundMoney(normalizedLines.reduce((sum, line) => sum + line.amount, 0));
  const safeTaxRate = Math.max(0, Number(taxRate) || 0);
  const taxAmount = roundMoney(subtotal * safeTaxRate / 100);
  return { lines: normalizedLines, subtotal, taxAmount, total: roundMoney(subtotal + taxAmount) };
};

export const financialSummary = (state: AppState) => {
  const income = roundMoney(state.transactions
    .filter((item) => item.type === 'income')
    .reduce((sum, item) => sum + item.amount, 0));
  const expenses = roundMoney(state.transactions
    .filter((item) => item.type === 'expense')
    .reduce((sum, item) => sum + item.amount, 0));
  const deductibleExpenses = roundMoney(state.transactions
    .filter((item) => item.type === 'expense' && item.deductible)
    .reduce((sum, item) => sum + item.amount, 0));
  const taxableEstimate = Math.max(0, income - deductibleExpenses);
  const reserve = roundMoney(taxableEstimate * Math.max(0, state.settings.taxReserveRate) / 100);
  const safeToSpend = roundMoney(Math.max(0, income - expenses - reserve));
  const outstanding = roundMoney(state.invoices
    .filter((invoice) => invoice.status === 'sent' || invoice.status === 'overdue')
    .reduce((sum, invoice) => sum + invoice.total, 0));
  return { income, expenses, deductibleExpenses, taxableEstimate, reserve, safeToSpend, outstanding };
};

export const elapsedMinutes = (item: WorkItem, now = Date.now()) => {
  if (!item.startedAt) return item.minutes;
  return item.minutes + Math.max(0, Math.floor((now - new Date(item.startedAt).getTime()) / 60000));
};
