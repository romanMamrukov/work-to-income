import type { Invoice, Language } from './domain';

const escapeHtml = (value: string | number) => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

const amount = (value: number, currency: string, language: Language) => new Intl.NumberFormat(
  language === 'lv' ? 'lv-LV' : 'en-LV', { style: 'currency', currency },
).format(value);

const partyLines = (party: Invoice['seller']) => [
  party.registrationNumber, party.vatNumber, party.address,
  [party.postalCode, party.country].filter(Boolean).join(', '), party.email, party.phone,
].filter(Boolean).map((line) => `<div>${escapeHtml(line)}</div>`).join('');

export const downloadInvoicePdf = async (invoice: Invoice, language: Language) => {
  const lv = language === 'lv';
  const container = document.createElement('div');
  container.lang = language;
  container.style.cssText = 'position:fixed;left:-10000px;top:0;width:760px;background:#fff;color:#16211f;font-family:Arial,"Noto Sans",sans-serif;padding:48px;box-sizing:border-box;';
  container.innerHTML = `
    <style>
      *{box-sizing:border-box} .top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:42px}
      h1{font-size:31px;margin:0 0 7px;letter-spacing:-1px}.number{text-align:right;font-size:16px;font-weight:700}.dates{margin-top:8px;color:#596964;font-size:12px;line-height:1.6}
      .parties{display:grid;grid-template-columns:1fr 1fr;gap:45px;margin-bottom:38px}.party small{display:block;color:#6a7874;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:9px}.party h2{font-size:17px;margin:0 0 8px}.party div{font-size:12px;line-height:1.55;color:#46534f}
      table{width:100%;border-collapse:collapse;font-size:12px}th{padding:10px;background:#16211f;color:#fff;text-align:left}th:last-child,td:last-child{text-align:right}td{padding:12px 10px;border-bottom:1px solid #e2e7e2;vertical-align:top}
      .summary{width:290px;margin:22px 0 0 auto}.summary div{display:flex;justify-content:space-between;padding:6px 0;font-size:12px}.summary .total{border-top:2px solid #16211f;margin-top:4px;padding-top:11px;font-size:18px;font-weight:700}
      .footer{margin-top:42px;padding-top:18px;border-top:1px solid #dce3dc;font-size:11px;line-height:1.6;color:#53625d}.notes{margin-bottom:12px;white-space:pre-wrap}
    </style>
    <div class="top"><div><h1>${lv ? 'RĒĶINS' : 'INVOICE'}</h1></div><div><div class="number">${escapeHtml(invoice.number)}</div><div class="dates">${lv ? 'Izrakstīts' : 'Issued'}: ${escapeHtml(invoice.issueDate)}<br>${lv ? 'Apmaksāt līdz' : 'Due'}: ${escapeHtml(invoice.dueDate)}</div></div></div>
    <div class="parties"><div class="party"><small>${lv ? 'Pārdevējs' : 'Seller'}</small><h2>${escapeHtml(invoice.seller.name)}</h2>${partyLines(invoice.seller)}</div><div class="party"><small>${lv ? 'Pircējs' : 'Buyer'}</small><h2>${escapeHtml(invoice.buyer.name)}</h2>${partyLines(invoice.buyer)}</div></div>
    <table><thead><tr><th>${lv ? 'Apraksts' : 'Description'}</th><th>${lv ? 'Daudzums' : 'Quantity'}</th><th>${lv ? 'Cena' : 'Rate'}</th><th>${lv ? 'Summa' : 'Amount'}</th></tr></thead><tbody>${invoice.lines.map((line) => `<tr><td>${escapeHtml(line.description)}</td><td>${escapeHtml(line.quantity)} ${escapeHtml(line.unit)}</td><td>${escapeHtml(amount(line.rate, invoice.currency, language))}</td><td>${escapeHtml(amount(line.amount, invoice.currency, language))}</td></tr>`).join('')}</tbody></table>
    <div class="summary"><div><span>${lv ? 'Summa bez nodokļa' : 'Subtotal'}</span><strong>${escapeHtml(amount(invoice.subtotal, invoice.currency, language))}</strong></div>${invoice.taxRate > 0 ? `<div><span>${lv ? 'Nodoklis' : 'Tax'} (${escapeHtml(invoice.taxRate)}%)</span><strong>${escapeHtml(amount(invoice.taxAmount, invoice.currency, language))}</strong></div>` : ''}<div class="total"><span>${lv ? 'Kopā' : 'Total'}</span><strong>${escapeHtml(amount(invoice.total, invoice.currency, language))}</strong></div></div>
    <div class="footer">${invoice.notes ? `<div class="notes">${escapeHtml(invoice.notes)}</div>` : ''}<div>${[invoice.seller.bankName, invoice.seller.iban && `IBAN: ${invoice.seller.iban}`, invoice.seller.swift && `SWIFT/BIC: ${invoice.seller.swift}`].filter(Boolean).map(escapeHtml).join(' · ')}</div></div>`;
  document.body.appendChild(container);
  try {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
    await doc.html(container, {
      x: 0, y: 0, width: 595, windowWidth: 760, autoPaging: 'text',
      html2canvas: { scale: 1.5, useCORS: true, backgroundColor: '#ffffff' },
    });
    doc.save(`${invoice.number}.pdf`);
  } finally { container.remove(); }
};
