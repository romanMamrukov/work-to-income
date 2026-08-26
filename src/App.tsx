import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, BriefcaseBusiness, Check, ChevronRight,
  CircleDollarSign, Clock3, Download, FilePlus2, FileText, LayoutDashboard, Menu,
  Pause, Play, Plus, ReceiptText, RotateCcw, Save, Settings as SettingsIcon,
  ShieldCheck, Trash2, Upload, Users, WalletCards, X,
} from 'lucide-react';
import type {
  AppState, Client, Invoice, InvoiceLine, InvoiceStatus, Page, TransactionType, WorkItem,
} from './domain';
import {
  addDays, calculateInvoice, createId, elapsedMinutes, financialSummary, isoDate, roundMoney,
} from './domain';
import { demoState, downloadBackup, emptyState, loadState, parseBackup, saveState } from './storage';
import { downloadInvoicePdf } from './pdf';

const nav: Array<{ id: Page; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'invoices', label: 'Invoices', icon: FileText },
  { id: 'clients', label: 'Clients', icon: Users },
  { id: 'work', label: 'Work', icon: BriefcaseBusiness },
  { id: 'money', label: 'Money', icon: WalletCards },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

const pageMeta: Record<Page, { eyebrow: string; title: string; description: string }> = {
  overview: { eyebrow: 'Your position', title: 'From work to spendable income', description: 'One view of work delivered, money collected and the reserve you should keep aside.' },
  invoices: { eyebrow: 'Get paid', title: 'Invoices', description: 'Create a professional invoice directly or turn completed work into one.' },
  clients: { eyebrow: 'Relationships', title: 'Clients', description: 'Keep billing details and commercial history in one place.' },
  work: { eyebrow: 'Delivery', title: 'Work', description: 'Track billable work only when it helps. Quick invoices never require a task.' },
  money: { eyebrow: 'Cash control', title: 'Money', description: 'Record income and expenses, then estimate what is safe to spend.' },
  settings: { eyebrow: 'Workspace', title: 'Settings & data', description: 'Configure invoice details and keep a portable backup of your data.' },
};

const formatMoney = (value: number, currency = 'EUR') => new Intl.NumberFormat('en-LV', {
  style: 'currency', currency, maximumFractionDigits: 2,
}).format(value);

const formatMinutes = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}h ${rest}m` : `${rest}m`;
};

const invoiceStatus = (invoice: Invoice): InvoiceStatus =>
  invoice.status === 'sent' && invoice.dueDate < isoDate() ? 'overdue' : invoice.status;

function Button({ children, variant = 'primary', className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  return <button className={`button ${variant} ${className}`} {...props}>{children}</button>;
}

function Empty({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return <div className="empty"><div className="empty-icon"><ReceiptText size={23} /></div><h3>{title}</h3><p>{text}</p>{action}</div>;
}

function Status({ value }: { value: string }) {
  return <span className={`status status-${value}`}>{value}</span>;
}

function Metric({ label, value, note, accent = false }: { label: string; value: string; note: string; accent?: boolean }) {
  return <article className={`metric ${accent ? 'accent' : ''}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}

type InvoiceSeed = { clientId?: string; workItem?: WorkItem } | null;

function InvoiceModal({ state, seed, onClose, onSave }: {
  state: AppState;
  seed: InvoiceSeed;
  onClose: () => void;
  onSave: (invoice: Invoice, client?: Client) => void;
}) {
  const today = isoDate();
  const work = seed?.workItem;
  const initialLine: InvoiceLine = work
    ? { id: createId('line'), description: work.title, quantity: roundMoney(elapsedMinutes(work) / 60), unit: 'hours', rate: work.rate, amount: 0, workItemId: work.id }
    : { id: createId('line'), description: '', quantity: 1, unit: 'service', rate: 0, amount: 0 };
  const [clientId, setClientId] = useState(seed?.clientId || work?.clientId || '');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientRegistration, setClientRegistration] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [issueDate, setIssueDate] = useState(today);
  const [dueDate, setDueDate] = useState(addDays(today, state.settings.paymentTermsDays));
  const [taxRate, setTaxRate] = useState(0);
  const [notes, setNotes] = useState(state.settings.invoiceNotes);
  const [lines, setLines] = useState<InvoiceLine[]>([initialLine]);
  const [error, setError] = useState('');
  const totals = calculateInvoice(lines, taxRate);

  const updateLine = (id: string, patch: Partial<InvoiceLine>) =>
    setLines((current) => current.map((line) => line.id === id ? { ...line, ...patch } : line));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const existingClient = state.clients.find((client) => client.id === clientId);
    if (!existingClient && !clientName.trim()) return setError('Select a client or enter a new client name.');
    if (!totals.lines.length || totals.lines.some((line) => !line.description.trim() || line.amount <= 0)) {
      return setError('Every line needs a description, quantity and positive rate.');
    }
    const client = existingClient ? undefined : {
      id: createId('client'), name: clientName.trim(), registrationNumber: clientRegistration.trim(), vatNumber: '',
      email: clientEmail.trim(), phone: '', address: clientAddress.trim(), createdAt: new Date().toISOString(),
    };
    const number = `${state.settings.invoicePrefix || 'INV'}-${String(state.settings.nextInvoiceNumber).padStart(4, '0')}`;
    onSave({
      id: createId('invoice'), number, clientId: existingClient?.id || client!.id, issueDate, dueDate,
      status: 'draft', currency: state.settings.currency, lines: totals.lines, subtotal: totals.subtotal,
      taxRate: Math.max(0, taxRate), taxAmount: totals.taxAmount, total: totals.total,
      paidAt: null, notes: notes.trim(), createdAt: new Date().toISOString(),
    }, client);
  };

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="modal" role="dialog" aria-modal="true" aria-labelledby="invoice-modal-title">
      <div className="modal-head"><div><span className="eyebrow">No project required</span><h2 id="invoice-modal-title">Create invoice</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={20} /></button></div>
      <form onSubmit={submit}>
        {error && <div className="form-error">{error}</div>}
        <div className="form-grid two">
          <label>Existing client<select value={clientId} onChange={(e) => setClientId(e.target.value)}><option value="">Create a new client below</option>{state.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
          <label>New client name<input value={clientName} onChange={(e) => setClientName(e.target.value)} disabled={Boolean(clientId)} placeholder="Client or company" /></label>
          {!clientId && <>
            <label>Email<input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} /></label>
            <label>Registration number<input value={clientRegistration} onChange={(e) => setClientRegistration(e.target.value)} /></label>
            <label className="span-two">Address<input value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} /></label>
          </>}
          <label>Issue date<input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} required /></label>
          <label>Due date<input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required /></label>
        </div>
        <div className="line-editor">
          <div className="line-heading"><strong>Line items</strong><button type="button" className="text-button" onClick={() => setLines((items) => [...items, { id: createId('line'), description: '', quantity: 1, unit: 'service', rate: 0, amount: 0 }])}><Plus size={15} /> Add line</button></div>
          {lines.map((line) => <div className="invoice-line" key={line.id}>
            <label className="line-description">Description<input value={line.description} onChange={(e) => updateLine(line.id, { description: e.target.value })} placeholder="Service delivered" /></label>
            <label>Quantity<input type="number" min="0" step="0.01" value={line.quantity} onChange={(e) => updateLine(line.id, { quantity: Number(e.target.value) })} /></label>
            <label>Unit<input value={line.unit} onChange={(e) => updateLine(line.id, { unit: e.target.value })} /></label>
            <label>Rate<input type="number" min="0" step="0.01" value={line.rate} onChange={(e) => updateLine(line.id, { rate: Number(e.target.value) })} /></label>
            <strong>{formatMoney(line.quantity * line.rate, state.settings.currency)}</strong>
            <button type="button" className="icon-button small" onClick={() => setLines((items) => items.filter((item) => item.id !== line.id))} disabled={lines.length === 1} aria-label="Remove line"><Trash2 size={16} /></button>
          </div>)}
        </div>
        <div className="invoice-bottom">
          <div className="form-grid">
            <label>Tax / VAT rate (%)<input type="number" min="0" step="0.01" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} /></label>
            <label>Notes<textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
          </div>
          <div className="totals"><div><span>Subtotal</span><strong>{formatMoney(totals.subtotal, state.settings.currency)}</strong></div><div><span>Tax</span><strong>{formatMoney(totals.taxAmount, state.settings.currency)}</strong></div><div className="grand-total"><span>Total</span><strong>{formatMoney(totals.total, state.settings.currency)}</strong></div></div>
        </div>
        <div className="modal-actions"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit"><FilePlus2 size={17} /> Save draft</Button></div>
      </form>
    </section>
  </div>;
}

function Overview({ state, setPage, newInvoice }: { state: AppState; setPage: (page: Page) => void; newInvoice: () => void }) {
  const summary = financialSummary(state);
  const active = state.workItems.filter((item) => item.status === 'active').length;
  const recent = state.invoices.slice(0, 4);
  return <>
    <section className="hero-card">
      <div><span className="eyebrow light">Available after costs and reserve</span><strong>{formatMoney(summary.safeToSpend, state.settings.currency)}</strong><p>Estimated from recorded income, expenses and a {state.settings.taxReserveRate}% planning reserve.</p></div>
      <div className="hero-actions"><Button onClick={newInvoice}><FilePlus2 size={17} /> Quick invoice</Button><Button variant="secondary" onClick={() => setPage('money')}><Plus size={17} /> Record money</Button></div>
    </section>
    <section className="metric-grid">
      <Metric label="Income recorded" value={formatMoney(summary.income, state.settings.currency)} note="Received payments and manual income" />
      <Metric label="Tax reserve" value={formatMoney(summary.reserve, state.settings.currency)} note="Planning estimate, not a tax filing" accent />
      <Metric label="Outstanding" value={formatMoney(summary.outstanding, state.settings.currency)} note="Sent or overdue invoices" />
      <Metric label="Active work" value={String(active)} note={`${state.workItems.filter((item) => item.status === 'done').length} ready to invoice`} />
    </section>
    <section className="content-grid overview-grid">
      <article className="panel flow-panel"><div className="panel-head"><div><span className="eyebrow">Core workflow</span><h2>Move work forward</h2></div></div>
        <div className="flow-steps">
          <button onClick={() => setPage('work')}><span>01</span><div><strong>Deliver work</strong><small>Optional tasks and time tracking</small></div><ChevronRight size={18} /></button>
          <button onClick={() => setPage('invoices')}><span>02</span><div><strong>Send invoice</strong><small>Directly or from completed work</small></div><ChevronRight size={18} /></button>
          <button onClick={() => setPage('money')}><span>03</span><div><strong>Collect and reserve</strong><small>Record payment and protect tax cash</small></div><ChevronRight size={18} /></button>
        </div>
      </article>
      <article className="panel"><div className="panel-head"><div><span className="eyebrow">Recent</span><h2>Invoices</h2></div><button className="text-button" onClick={() => setPage('invoices')}>View all <ArrowRight size={15} /></button></div>
        {recent.length ? <div className="compact-list">{recent.map((invoice) => <div key={invoice.id}><div><strong>{invoice.number}</strong><small>{state.clients.find((client) => client.id === invoice.clientId)?.name || 'Unknown client'}</small></div><div className="align-right"><strong>{formatMoney(invoice.total, invoice.currency)}</strong><Status value={invoiceStatus(invoice)} /></div></div>)}</div> : <Empty title="No invoices yet" text="Create a direct invoice in under a minute." />}
      </article>
    </section>
    <div className="notice"><ShieldCheck size={18} /><div><strong>Private by default</strong><span>Your data stays in this browser until you export it. Create regular backups before clearing browser data.</span></div></div>
  </>;
}

function Invoices({ state, update, newInvoice }: { state: AppState; update: React.Dispatch<React.SetStateAction<AppState>>; newInvoice: () => void }) {
  const [filter, setFilter] = useState<'all' | InvoiceStatus>('all');
  const invoices = state.invoices.filter((invoice) => filter === 'all' || invoiceStatus(invoice) === filter);
  const setStatus = (id: string, status: InvoiceStatus) => update((current) => ({ ...current, invoices: current.invoices.map((invoice) => invoice.id === id ? { ...invoice, status } : invoice) }));
  const markPaid = (invoice: Invoice) => update((current) => {
    const alreadyRecorded = current.transactions.some((tx) => tx.invoiceId === invoice.id && tx.type === 'income');
    return {
      ...current,
      invoices: current.invoices.map((item) => item.id === invoice.id ? { ...item, status: 'paid', paidAt: isoDate() } : item),
      transactions: alreadyRecorded ? current.transactions : [{ id: createId('tx'), type: 'income', amount: invoice.total, category: 'Invoice payment', description: `${invoice.number} payment`, date: isoDate(), deductible: false, invoiceId: invoice.id }, ...current.transactions],
    };
  });
  return <article className="panel">
    <div className="toolbar"><div className="filters">{(['all', 'draft', 'sent', 'paid', 'overdue'] as const).map((item) => <button className={filter === item ? 'active' : ''} key={item} onClick={() => setFilter(item)}>{item}</button>)}</div><Button onClick={newInvoice}><Plus size={17} /> New invoice</Button></div>
    {invoices.length ? <div className="table-wrap"><table><thead><tr><th>Invoice</th><th>Client</th><th>Due</th><th>Status</th><th className="align-right">Amount</th><th></th></tr></thead><tbody>{invoices.map((invoice) => {
      const client = state.clients.find((item) => item.id === invoice.clientId);
      const status = invoiceStatus(invoice);
      return <tr key={invoice.id}><td><strong>{invoice.number}</strong><small>{invoice.issueDate}</small></td><td>{client?.name || 'Unknown client'}</td><td>{invoice.dueDate}</td><td><Status value={status} /></td><td className="align-right"><strong>{formatMoney(invoice.total, invoice.currency)}</strong></td><td><div className="row-actions"><button onClick={() => downloadInvoicePdf(invoice, client, state.settings)} title="Download PDF"><Download size={16} /></button>{status === 'draft' && <button onClick={() => setStatus(invoice.id, 'sent')} title="Mark sent"><ArrowUpRight size={16} /></button>}{status !== 'paid' && status !== 'cancelled' && <button onClick={() => markPaid(invoice)} title="Mark paid"><Check size={16} /></button>}</div></td></tr>;
    })}</tbody></table></div> : <Empty title="No invoices in this view" text="Create a quick invoice or invoice completed work." action={<Button onClick={newInvoice}><Plus size={17} /> Create invoice</Button>} />}
  </article>;
}

function Clients({ state, update }: { state: AppState; update: React.Dispatch<React.SetStateAction<AppState>> }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', registrationNumber: '', address: '', phone: '' });
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    const client: Client = { id: createId('client'), name: form.name.trim(), email: form.email.trim(), registrationNumber: form.registrationNumber.trim(), vatNumber: '', address: form.address.trim(), phone: form.phone.trim(), createdAt: new Date().toISOString() };
    update((current) => ({ ...current, clients: [client, ...current.clients] }));
    setForm({ name: '', email: '', registrationNumber: '', address: '', phone: '' });
    setOpen(false);
  };
  return <>
    <div className="section-actions"><Button onClick={() => setOpen((value) => !value)}><Plus size={17} /> Add client</Button></div>
    {open && <form className="panel inline-form" onSubmit={submit}><div className="form-grid three"><label>Client name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label><label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label><label>Registration number<input value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} /></label><label>Phone<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label><label className="span-two">Address<input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label></div><div className="form-actions"><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit"><Save size={16} /> Save client</Button></div></form>}
    {state.clients.length ? <div className="card-grid">{state.clients.map((client) => {
      const invoices = state.invoices.filter((invoice) => invoice.clientId === client.id);
      const billed = invoices.reduce((sum, invoice) => sum + invoice.total, 0);
      return <article className="client-card" key={client.id}><div className="avatar">{client.name.slice(0, 2).toUpperCase()}</div><div className="client-main"><h3>{client.name}</h3><p>{client.email || 'No email added'}</p><span>{client.registrationNumber || 'Registration not set'}</span></div><div className="client-stats"><div><strong>{invoices.length}</strong><small>Invoices</small></div><div><strong>{formatMoney(billed, state.settings.currency)}</strong><small>Total billed</small></div></div></article>;
    })}</div> : <div className="panel"><Empty title="No clients yet" text="Clients can also be created while making a quick invoice." /></div>}
  </>;
}

function Work({ state, update, createFromWork }: { state: AppState; update: React.Dispatch<React.SetStateAction<AppState>>; createFromWork: (item: WorkItem) => void }) {
  const [clock, setClock] = useState(Date.now());
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', clientId: '', rate: state.settings.defaultHourlyRate, description: '' });
  useEffect(() => { const timer = window.setInterval(() => setClock(Date.now()), 30000); return () => window.clearInterval(timer); }, []);
  const add = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim()) return;
    const item: WorkItem = { id: createId('work'), title: form.title.trim(), description: form.description.trim(), clientId: form.clientId, rate: Math.max(0, form.rate), minutes: 0, status: 'planned', startedAt: null, invoiceId: null, createdAt: new Date().toISOString() };
    update((current) => ({ ...current, workItems: [item, ...current.workItems] })); setOpen(false); setForm({ title: '', clientId: '', rate: state.settings.defaultHourlyRate, description: '' });
  };
  const start = (id: string) => update((current) => ({ ...current, workItems: current.workItems.map((item) => {
    if (item.id === id) return { ...item, status: 'active', startedAt: new Date().toISOString() };
    if (item.startedAt) return { ...item, minutes: elapsedMinutes(item), startedAt: null, status: 'planned' };
    return item;
  }) }));
  const pause = (id: string) => update((current) => ({ ...current, workItems: current.workItems.map((item) => item.id === id ? { ...item, minutes: elapsedMinutes(item), startedAt: null, status: 'planned' } : item) }));
  const finish = (id: string) => update((current) => ({ ...current, workItems: current.workItems.map((item) => item.id === id ? { ...item, minutes: elapsedMinutes(item), startedAt: null, status: 'done' } : item) }));
  return <>
    <div className="section-actions"><Button onClick={() => setOpen((value) => !value)}><Plus size={17} /> Add work</Button></div>
    {open && <form className="panel inline-form" onSubmit={add}><div className="form-grid two"><label>Work title<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></label><label>Client<select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}><option value="">No client yet</option>{state.clients.map((client) => <option value={client.id} key={client.id}>{client.name}</option>)}</select></label><label>Hourly rate<input type="number" min="0" step="0.01" value={form.rate} onChange={(e) => setForm({ ...form, rate: Number(e.target.value) })} /></label><label>Description<input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label></div><div className="form-actions"><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit"><Save size={16} /> Add work</Button></div></form>}
    {state.workItems.length ? <div className="work-list">{state.workItems.map((item) => {
      const minutes = elapsedMinutes(item, clock);
      const client = state.clients.find((value) => value.id === item.clientId);
      return <article className={`work-card ${item.status === 'active' ? 'running' : ''}`} key={item.id}><div className="work-state">{item.status === 'active' ? <span className="pulse" /> : <Clock3 size={18} />}</div><div className="work-info"><div className="work-title"><h3>{item.title}</h3><Status value={item.status} /></div><p>{client?.name || 'No client'}{item.description ? ` · ${item.description}` : ''}</p><div className="work-meta"><strong>{formatMinutes(minutes)}</strong><span>{formatMoney(item.rate, state.settings.currency)}/h</span><span>{formatMoney(roundMoney(minutes / 60 * item.rate), state.settings.currency)} billable</span></div></div><div className="work-actions">{item.startedAt ? <Button variant="secondary" onClick={() => pause(item.id)}><Pause size={16} /> Pause</Button> : item.status !== 'done' && item.status !== 'invoiced' ? <Button variant="secondary" onClick={() => start(item.id)}><Play size={16} /> Start</Button> : null}{item.status !== 'done' && item.status !== 'invoiced' && <Button variant="ghost" onClick={() => finish(item.id)}><Check size={16} /> Complete</Button>}{item.status === 'done' && <Button onClick={() => createFromWork(item)}><FilePlus2 size={16} /> Invoice</Button>}</div></article>;
    })}</div> : <div className="panel"><Empty title="No tracked work" text="Use work tracking only for hourly or project-based billing. Direct invoices remain available." /></div>}
  </>;
}

function Money({ state, update }: { state: AppState; update: React.Dispatch<React.SetStateAction<AppState>> }) {
  const [type, setType] = useState<TransactionType>('expense');
  const [form, setForm] = useState({ amount: 0, category: '', description: '', date: isoDate(), deductible: true });
  const summary = financialSummary(state);
  const submit = (event: React.FormEvent) => {
    event.preventDefault(); if (form.amount <= 0 || !form.description.trim()) return;
    update((current) => ({ ...current, transactions: [{ id: createId('tx'), type, amount: roundMoney(form.amount), category: form.category.trim() || (type === 'income' ? 'Other income' : 'Other expense'), description: form.description.trim(), date: form.date, deductible: type === 'expense' && form.deductible }, ...current.transactions] }));
    setForm({ amount: 0, category: '', description: '', date: isoDate(), deductible: true });
  };
  const exportCsv = () => {
    const escape = (value: string | number | boolean) => `"${String(value).replaceAll('"', '""')}"`;
    const rows = [['date', 'type', 'description', 'category', 'amount', 'deductible'], ...state.transactions.map((tx) => [tx.date, tx.type, tx.description, tx.category, tx.amount, tx.deductible])];
    const blob = new Blob([rows.map((row) => row.map(escape).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `work-to-income-transactions-${isoDate()}.csv`; link.click(); URL.revokeObjectURL(link.href);
  };
  return <section className="content-grid money-grid">
    <div><div className="metric-grid money-metrics"><Metric label="Income" value={formatMoney(summary.income, state.settings.currency)} note="Recorded cash in" /><Metric label="Expenses" value={formatMoney(summary.expenses, state.settings.currency)} note="Recorded cash out" /><Metric label="Reserve" value={formatMoney(summary.reserve, state.settings.currency)} note={`${state.settings.taxReserveRate}% planning rate`} accent /></div>
      <article className="panel"><div className="panel-head"><div><span className="eyebrow">Ledger</span><h2>Transactions</h2></div><button className="text-button" onClick={exportCsv}><Download size={15} /> Export CSV</button></div>{state.transactions.length ? <div className="transaction-list">{state.transactions.map((tx) => <div key={tx.id}><span className={`transaction-icon ${tx.type}`}>{tx.type === 'income' ? <ArrowDownRight size={17} /> : <ArrowUpRight size={17} />}</span><div><strong>{tx.description}</strong><small>{tx.date} · {tx.category}{tx.deductible ? ' · deductible' : ''}</small></div><strong className={tx.type}>{tx.type === 'income' ? '+' : '-'}{formatMoney(tx.amount, state.settings.currency)}</strong></div>)}</div> : <Empty title="No transactions" text="Record income and expenses to calculate spendable cash." />}</article>
    </div>
    <form className="panel transaction-form" onSubmit={submit}><span className="eyebrow">New entry</span><h2>Record money</h2><div className="segmented"><button type="button" className={type === 'income' ? 'active' : ''} onClick={() => setType('income')}>Income</button><button type="button" className={type === 'expense' ? 'active' : ''} onClick={() => setType('expense')}>Expense</button></div><label>Amount<input type="number" min="0.01" step="0.01" value={form.amount || ''} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} required /></label><label>Description<input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required /></label><label>Category<input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder={type === 'income' ? 'Services' : 'Software'} /></label><label>Date<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>{type === 'expense' && <label className="check-label"><input type="checkbox" checked={form.deductible} onChange={(e) => setForm({ ...form, deductible: e.target.checked })} /> Treat as deductible for reserve estimate</label>}<Button type="submit"><Plus size={17} /> Add {type}</Button><p className="disclaimer">The reserve is a planning estimate. It is not a tax return or professional tax advice.</p></form>
  </section>;
}

function Settings({ state, update, replace }: { state: AppState; update: React.Dispatch<React.SetStateAction<AppState>>; replace: (state: AppState) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const settings = state.settings;
  const field = (key: keyof typeof settings, value: string | number) => update((current) => ({ ...current, settings: { ...current.settings, [key]: value } }));
  const importBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    try { replace(parseBackup(await file.text())); } catch (error) { window.alert(error instanceof Error ? error.message : 'Could not import backup.'); }
    event.target.value = '';
  };
  const reset = (demo: boolean) => { if (window.confirm('Replace all current browser data? Export a backup first if you need it.')) replace(demo ? demoState() : emptyState()); };
  return <div className="settings-grid">
    <article className="panel"><div className="panel-head"><div><span className="eyebrow">Invoice identity</span><h2>Business details</h2></div></div><div className="form-grid two"><label>Business / seller name<input value={settings.businessName} onChange={(e) => field('businessName', e.target.value)} /></label><label>Registration number<input value={settings.registrationNumber} onChange={(e) => field('registrationNumber', e.target.value)} /></label><label>VAT number<input value={settings.vatNumber} onChange={(e) => field('vatNumber', e.target.value)} /></label><label>Email<input type="email" value={settings.email} onChange={(e) => field('email', e.target.value)} /></label><label>Phone<input value={settings.phone} onChange={(e) => field('phone', e.target.value)} /></label><label>Address<input value={settings.address} onChange={(e) => field('address', e.target.value)} /></label><label>Bank name<input value={settings.bankName} onChange={(e) => field('bankName', e.target.value)} /></label><label>IBAN<input value={settings.iban} onChange={(e) => field('iban', e.target.value)} /></label><label>SWIFT / BIC<input value={settings.swift} onChange={(e) => field('swift', e.target.value)} /></label><label>Currency<select value={settings.currency} onChange={(e) => field('currency', e.target.value)}><option>EUR</option><option>USD</option><option>GBP</option></select></label></div></article>
    <article className="panel"><div className="panel-head"><div><span className="eyebrow">Defaults</span><h2>Workflow rules</h2></div></div><div className="form-grid two"><label>Invoice prefix<input value={settings.invoicePrefix} onChange={(e) => field('invoicePrefix', e.target.value.toUpperCase())} /></label><label>Next invoice number<input type="number" min="1" value={settings.nextInvoiceNumber} onChange={(e) => field('nextInvoiceNumber', Number(e.target.value))} /></label><label>Payment terms (days)<input type="number" min="0" value={settings.paymentTermsDays} onChange={(e) => field('paymentTermsDays', Number(e.target.value))} /></label><label>Default hourly rate<input type="number" min="0" step="0.01" value={settings.defaultHourlyRate} onChange={(e) => field('defaultHourlyRate', Number(e.target.value))} /></label><label>Planning tax reserve (%)<input type="number" min="0" max="100" step="0.1" value={settings.taxReserveRate} onChange={(e) => field('taxReserveRate', Number(e.target.value))} /></label><label className="span-two">Invoice footer<textarea rows={3} value={settings.invoiceNotes} onChange={(e) => field('invoiceNotes', e.target.value)} /></label></div><div className="tax-warning">Tax reserve is deliberately configurable and indicative. Validate your actual obligations with a qualified Latvian accountant or VID guidance.</div></article>
    <article className="panel data-panel"><div><span className="eyebrow">Portability</span><h2>Your data</h2><p>Work to Income stores data in this browser. Backups are readable JSON files and can be restored on another device.</p></div><div className="data-actions"><Button onClick={() => downloadBackup(state)}><Download size={17} /> Export backup</Button><Button variant="secondary" onClick={() => fileRef.current?.click()}><Upload size={17} /> Import backup</Button><input ref={fileRef} type="file" accept="application/json" hidden onChange={importBackup} /><Button variant="ghost" onClick={() => reset(true)}><RotateCcw size={17} /> Load demo</Button><Button variant="danger" onClick={() => reset(false)}><Trash2 size={17} /> Start empty</Button></div></article>
  </div>;
}

export default function App() {
  const [state, setState] = useState<AppState>(loadState);
  const [page, setPage] = useState<Page>('overview');
  const [menu, setMenu] = useState(false);
  const [invoiceSeed, setInvoiceSeed] = useState<InvoiceSeed>(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    try { saveState(state); setSaveError(''); } catch { setSaveError('Browser storage is unavailable or full. Export a backup now.'); }
  }, [state]);

  const summary = useMemo(() => financialSummary(state), [state]);
  const openInvoice = (seed: InvoiceSeed = null) => { setInvoiceSeed(seed); setInvoiceOpen(true); };
  const saveInvoice = (invoice: Invoice, client?: Client) => {
    setState((current) => ({
      ...current,
      clients: client ? [client, ...current.clients] : current.clients,
      invoices: [invoice, ...current.invoices],
      workItems: current.workItems.map((item) => invoice.lines.some((line) => line.workItemId === item.id) ? { ...item, status: 'invoiced', invoiceId: invoice.id, startedAt: null } : item),
      settings: { ...current.settings, nextInvoiceNumber: current.settings.nextInvoiceNumber + 1 },
    }));
    setInvoiceOpen(false); setInvoiceSeed(null); setPage('invoices');
  };
  const meta = pageMeta[page];

  return <div className="app-shell">
    <aside className={`sidebar ${menu ? 'open' : ''}`}>
      <div className="brand"><span>WTI</span><div><strong>Work to Income</strong><small>Freelance control</small></div><button className="close-menu" onClick={() => setMenu(false)}><X size={19} /></button></div>
      <nav>{nav.map((item) => { const Icon = item.icon; return <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => { setPage(item.id); setMenu(false); }}><Icon size={18} /><span>{item.label}</span>{item.id === 'invoices' && state.invoices.length > 0 && <b>{state.invoices.length}</b>}</button>; })}</nav>
      <div className="side-card"><CircleDollarSign size={19} /><span>Safe to spend</span><strong>{formatMoney(summary.safeToSpend, state.settings.currency)}</strong></div>
      <div className="privacy"><ShieldCheck size={16} /><div><strong>Local-first</strong><span>Saved in this browser</span></div></div>
    </aside>
    <div className="workspace">
      <header className="mobile-top"><button className="icon-button" onClick={() => setMenu(true)}><Menu size={20} /></button><strong>Work to Income</strong><Button onClick={() => openInvoice()}><Plus size={17} /><span>Invoice</span></Button></header>
      {saveError && <div className="save-error">{saveError}</div>}
      <main>
        <header className="page-header"><div><span className="eyebrow">{meta.eyebrow}</span><h1>{meta.title}</h1><p>{meta.description}</p></div>{page !== 'settings' && <Button className="desktop-action" onClick={() => openInvoice()}><FilePlus2 size={17} /> Quick invoice</Button>}</header>
        {page === 'overview' && <Overview state={state} setPage={setPage} newInvoice={() => openInvoice()} />}
        {page === 'invoices' && <Invoices state={state} update={setState} newInvoice={() => openInvoice()} />}
        {page === 'clients' && <Clients state={state} update={setState} />}
        {page === 'work' && <Work state={state} update={setState} createFromWork={(item) => openInvoice({ clientId: item.clientId, workItem: item })} />}
        {page === 'money' && <Money state={state} update={setState} />}
        {page === 'settings' && <Settings state={state} update={setState} replace={setState} />}
      </main>
    </div>
    {menu && <div className="menu-shade" onClick={() => setMenu(false)} />}
    {invoiceOpen && <InvoiceModal state={state} seed={invoiceSeed} onClose={() => setInvoiceOpen(false)} onSave={saveInvoice} />}
  </div>;
}
