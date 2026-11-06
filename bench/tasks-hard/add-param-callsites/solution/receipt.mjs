import { formatPrice } from "./money.mjs";

export function receiptHeader(order, locale) {
  return `${locale.storeName} - order ${order.id}`;
}

export function receiptPayment(order, locale) {
  const paid = order.payments.reduce((sum, p) => sum + p.amount, 0);
  const lines = order.payments.map((p) => `${p.method}: ${formatPrice(p.amount, p.currency)}`);
  lines.push(`Paid: ${formatPrice(paid, order.currency)}`);
  return lines;
}

export function receiptRefund(order, locale, refund) {
  return `${locale.storeName} refunded ${formatPrice(refund.amount, refund.currency)} to ${refund.method}.`;
}
