import { formatPrice, sumLines } from "./money.mjs";

export function invoiceLines(invoice) {
  return invoice.lines.map(
    (line) => `${line.description} x${line.quantity} @ ${formatPrice(line.unitPrice)} = ${formatPrice(line.unitPrice * line.quantity)}`,
  );
}

export function invoiceTotal(invoice) {
  const subtotal = sumLines(invoice.lines);
  const tax = Math.round(subtotal * invoice.taxRate);
  return [`Subtotal: ${formatPrice(subtotal)}`, `Tax: ${formatPrice(tax)}`, `Total: ${formatPrice(subtotal + tax)}`];
}

export function overdueNotice(invoice, settings) {
  const fee = settings.lateFee;
  return `Invoice ${invoice.number} is overdue. A late fee of ${formatPrice(fee)} has been added.`;
}
