import type { Invoice, Language } from './domain';
import { invoiceUnitLabel } from './domain';

const amount = (value: number, currency: string, language: Language) => new Intl.NumberFormat(
  language === 'lv' ? 'lv-LV' : 'en-LV', { style: 'currency', currency },
).format(value);

const partyLines = (party: Invoice['seller']) => [
  party.registrationNumber, party.vatNumber, party.address,
  [party.postalCode, party.country].filter(Boolean).join(', '), party.email, party.phone,
].filter(Boolean);

let fontPromise: Promise<string> | null = null;

const loadUnicodeFont = () => {
  if (fontPromise) return fontPromise;
  fontPromise = fetch(`${import.meta.env.BASE_URL}fonts/DejaVuSans.ttf`)
    .then((response) => {
      if (!response.ok) throw new Error(`Could not load PDF font (${response.status}).`);
      return response.arrayBuffer();
    })
    .then((buffer) => {
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
      }
      return btoa(binary);
    });
  return fontPromise;
};

export const createInvoicePdf = async (invoice: Invoice, language: Language, font: string) => {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true, putOnlyUsedFonts: true });
  doc.addFileToVFS('DejaVuSans.ttf', font);
  doc.addFont('DejaVuSans.ttf', 'DejaVuSans', 'normal');
  doc.setFont('DejaVuSans', 'normal');
  doc.setProperties({ title: invoice.number, subject: language === 'lv' ? 'Rēķins' : 'Invoice' });

  const lv = language === 'lv';
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 44;
  const contentWidth = pageWidth - margin * 2;
  const bottom = pageHeight - 48;
  const green: [number, number, number] = [22, 33, 31];
  const muted: [number, number, number] = [82, 98, 93];
  let y = margin;

  const setText = (size: number, color: [number, number, number] = green) => {
    doc.setFont('DejaVuSans', 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };
  const linesFor = (value: string, width: number) => doc.splitTextToSize(value || '—', width) as string[];

  setText(28);
  doc.text(lv ? 'RĒĶINS' : 'INVOICE', margin, y + 22);
  setText(13);
  doc.text(invoice.number, pageWidth - margin, y + 5, { align: 'right' });
  setText(9, muted);
  doc.text(`${lv ? 'Izrakstīts' : 'Issued'}: ${invoice.issueDate}`, pageWidth - margin, y + 22, { align: 'right' });
  doc.text(`${lv ? 'Apmaksāt līdz' : 'Due'}: ${invoice.dueDate}`, pageWidth - margin, y + 36, { align: 'right' });
  y += 78;

  const drawParty = (title: string, party: Invoice['seller'], x: number) => {
    setText(8, muted);
    doc.text(title.toUpperCase(), x, y);
    setText(12);
    const nameLines = linesFor(party.name, 220);
    doc.text(nameLines, x, y + 18);
    setText(8.5, muted);
    const details = partyLines(party).flatMap((line) => linesFor(line, 220));
    doc.text(details, x, y + 18 + nameLines.length * 14);
    return 18 + nameLines.length * 14 + details.length * 12;
  };
  const sellerHeight = drawParty(lv ? 'Pārdevējs' : 'Seller', invoice.seller, margin);
  const buyerHeight = drawParty(lv ? 'Pircējs' : 'Buyer', invoice.buyer, margin + contentWidth / 2 + 12);
  y += Math.max(sellerHeight, buyerHeight) + 24;

  const columns = { description: margin + 8, quantity: margin + 278, rate: margin + 350, amount: pageWidth - margin - 8 };
  const drawTableHead = () => {
    doc.setFillColor(...green);
    doc.rect(margin, y, contentWidth, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8.5);
    doc.text(lv ? 'Apraksts' : 'Description', columns.description, y + 18);
    doc.text(lv ? 'Daudzums' : 'Quantity', columns.quantity, y + 18);
    doc.text(lv ? 'Cena' : 'Rate', columns.rate, y + 18);
    doc.text(lv ? 'Summa' : 'Amount', columns.amount, y + 18, { align: 'right' });
    y += 28;
  };
  const nextPage = () => { doc.addPage(); y = margin; drawTableHead(); };
  drawTableHead();

  invoice.lines.forEach((line) => {
    setText(8.5);
    const description = linesFor(line.description, 250);
    const rowHeight = Math.max(34, description.length * 12 + 16);
    if (y + rowHeight > bottom) nextPage();
    doc.text(description, columns.description, y + 17);
    const unit = invoiceUnitLabel(line.unit, language);
    doc.text(`${line.quantity} ${unit}`, columns.quantity, y + 17);
    doc.text(`${amount(line.rate, invoice.currency, language)} / ${unit}`, columns.rate, y + 17);
    doc.text(amount(line.amount, invoice.currency, language), columns.amount, y + 17, { align: 'right' });
    doc.setDrawColor(226, 231, 226);
    doc.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);
    y += rowHeight;
  });

  const summaryHeight = invoice.taxRate > 0 ? 86 : 62;
  if (y + summaryHeight + 70 > bottom) { doc.addPage(); y = margin; }
  const summaryX = pageWidth - margin - 225;
  y += 20;
  setText(9, muted);
  doc.text(lv ? 'Summa bez nodokļa' : 'Subtotal', summaryX, y);
  doc.text(amount(invoice.subtotal, invoice.currency, language), pageWidth - margin, y, { align: 'right' });
  if (invoice.taxRate > 0) {
    y += 20;
    doc.text(`${lv ? 'Nodoklis' : 'Tax'} (${invoice.taxRate}%)`, summaryX, y);
    doc.text(amount(invoice.taxAmount, invoice.currency, language), pageWidth - margin, y, { align: 'right' });
  }
  y += 16;
  doc.setDrawColor(...green);
  doc.setLineWidth(1.5);
  doc.line(summaryX, y, pageWidth - margin, y);
  y += 22;
  setText(14);
  doc.text(lv ? 'Kopā' : 'Total', summaryX, y);
  doc.text(amount(invoice.total, invoice.currency, language), pageWidth - margin, y, { align: 'right' });

  y += 42;
  setText(8.5, muted);
  if (invoice.notes) {
    const notes = linesFor(invoice.notes, contentWidth);
    if (y + notes.length * 12 > bottom) { doc.addPage(); y = margin; }
    doc.text(notes, margin, y);
    y += notes.length * 12 + 10;
  }
  const banking = [invoice.seller.bankName, invoice.seller.iban && `IBAN: ${invoice.seller.iban}`, invoice.seller.swift && `SWIFT/BIC: ${invoice.seller.swift}`].filter(Boolean).join(' · ');
  if (banking) doc.text(linesFor(banking, contentWidth), margin, y);

  const output = doc.output('arraybuffer');
  if (output.byteLength < 1_000) throw new Error('Generated PDF contains no document data.');
  return doc;
};

export const downloadInvoicePdf = async (invoice: Invoice, language: Language) => {
  const font = await loadUnicodeFont();
  const doc = await createInvoicePdf(invoice, language, font);
  const filename = `${invoice.number.replace(/[^a-zA-Z0-9._-]+/g, '_') || 'invoice'}.pdf`;
  doc.save(filename);
};
