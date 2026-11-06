import { formatPrice, sumLines } from "./money.mjs";

export function invoiceLines(invoice) {
  return invoice.lines.map(
    (line) => `${line.description} x${line.quantity} @ ${formatPrice(line.unitPrice, invoice.currency)} = ${formatPrice(line.unitPrice * line.quantity, invoice.currency)}`,
  );
}

export function invoiceTotal(invoice) {
  const subtotal = sumLines(invoice.lines);
  const tax = Math.round(subtotal * invoice.taxRate);
  return [`Subtotal: ${formatPrice(subtotal, invoice.currency)}`, `Tax: ${formatPrice(tax, invoice.currency)}`, `Total: ${formatPrice(subtotal + tax, invoice.currency)}`];
}

export function overdueNotice(invoice, settings) {
  const fee = settings.lateFee;
  return `Invoice ${invoice.number} is overdue. A late fee of ${formatPrice(fee, settings.billingCurrency)} has been added.`;
}
