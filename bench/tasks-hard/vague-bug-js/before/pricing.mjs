// Price arithmetic. All amounts are integers in cents.

export function lineTotal(item) {
  if (!Number.isInteger(item.priceCents) || item.priceCents < 0) throw new RangeError(`bad price for ${item.sku}`);
  if (!Number.isInteger(item.quantity) || item.quantity < 1) throw new RangeError(`bad quantity for ${item.sku}`);
  return item.priceCents * item.quantity;
}

export function subtotal(items) {
  return items.reduce((acc, item) => acc + lineTotal(item), 0);
}

// Percentage of an amount, rounded half up to the nearest cent.
export function percentOf(amountCents, percent) {
  return Math.floor((amountCents * percent) / 100 + 0.5);
}

export function taxFor(amountCents, ratePercent) {
  return percentOf(amountCents, ratePercent);
}

export function formatCents(cents) {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}
