import type { Client, Invoice, Settings } from './domain';

const money = (value: number, currency: string) => `${value.toFixed(2)} ${currency}`;

export const downloadInvoicePdf = async (invoice: Invoice, client: Client | undefined, settings: Settings) => {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const left = 18;
  const right = 192;
  let y = 20;

  doc.setTextColor(19, 33, 31);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('INVOICE', left, y);
  doc.setFontSize(11);
  doc.text(invoice.number, right, y, { align: 'right' });
  y += 12;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(86, 101, 96);
  doc.text(`Issued: ${invoice.issueDate}`, right, y, { align: 'right' });
  doc.text(`Due: ${invoice.dueDate}`, right, y + 5, { align: 'right' });

  doc.setTextColor(19, 33, 31);
  doc.setFont('helvetica', 'bold');
  doc.text(settings.businessName || 'Seller', left, y);
  doc.setFont('helvetica', 'normal');
  const seller = [settings.registrationNumber, settings.vatNumber, settings.address, settings.email, settings.phone].filter(Boolean);
  seller.forEach((line, index) => doc.text(line, left, y + 5 + index * 4.5));
  y = 54;

  doc.setFont('helvetica', 'bold');
  doc.text('BILL TO', left, y);
  doc.setFont('helvetica', 'normal');
  doc.text(client?.name || 'Client', left, y + 6);
  [client?.registrationNumber, client?.vatNumber, client?.address, client?.email].filter(Boolean)
    .forEach((line, index) => doc.text(String(line), left, y + 11 + index * 4.5));
  y = 86;

  doc.setFillColor(19, 33, 31);
  doc.rect(left, y, right - left, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('Description', left + 3, y + 5.3);
  doc.text('Qty', 135, y + 5.3, { align: 'right' });
  doc.text('Rate', 160, y + 5.3, { align: 'right' });
  doc.text('Amount', right - 3, y + 5.3, { align: 'right' });
  y += 13;

  doc.setTextColor(19, 33, 31);
  doc.setFont('helvetica', 'normal');
  invoice.lines.forEach((line) => {
    if (y > 246) {
      doc.addPage();
      y = 20;
    }
    const description = doc.splitTextToSize(line.description, 92);
    doc.text(description, left + 3, y);
    doc.text(`${line.quantity} ${line.unit}`, 135, y, { align: 'right' });
    doc.text(money(line.rate, invoice.currency), 160, y, { align: 'right' });
    doc.text(money(line.amount, invoice.currency), right - 3, y, { align: 'right' });
    y += Math.max(8, description.length * 4.5 + 3);
    doc.setDrawColor(225, 229, 224);
    doc.line(left, y - 3, right, y - 3);
  });

  y += 4;
  doc.text('Subtotal', 160, y, { align: 'right' });
  doc.text(money(invoice.subtotal, invoice.currency), right, y, { align: 'right' });
  if (invoice.taxRate > 0) {
    y += 6;
    doc.text(`Tax (${invoice.taxRate}%)`, 160, y, { align: 'right' });
    doc.text(money(invoice.taxAmount, invoice.currency), right, y, { align: 'right' });
  }
  y += 9;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Total', 160, y, { align: 'right' });
  doc.text(money(invoice.total, invoice.currency), right, y, { align: 'right' });

  y += 18;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  [settings.bankName, settings.iban && `IBAN: ${settings.iban}`, settings.swift && `SWIFT: ${settings.swift}`, invoice.notes]
    .filter(Boolean).forEach((line) => {
      doc.text(String(line), left, y);
      y += 5;
    });

  doc.save(`${invoice.number}.pdf`);
};
