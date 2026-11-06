import { computeDiscounts, findCoupon, PROMOTIONS } from "./coupons.mjs";
import { formatCents, subtotal, taxFor } from "./pricing.mjs";

export function checkout(cart, { couponCodes = [], promotionIds = [], taxRatePercent = 0, today = "2026-01-01" } = {}) {
  const sub = subtotal(cart.items);
  const coupons = couponCodes.map(findCoupon).filter(Boolean);
  const promotions = promotionIds.map((id) => PROMOTIONS[id]).filter(Boolean);
  const discountLines = computeDiscounts(sub, promotions, coupons, today);
  const discount = discountLines.reduce((acc, line) => acc + line.amountCents, 0);
  const taxable = sub - discount;
  const tax = taxFor(taxable, taxRatePercent);
  return { subtotal: sub, discountLines, discount, taxable, tax, total: taxable + tax };
}

export function receipt(result) {
  const rows = [`Subtotal ${formatCents(result.subtotal)}`];
  for (const line of result.discountLines) rows.push(`${line.label} -${formatCents(line.amountCents)}`);
  rows.push(`Tax ${formatCents(result.tax)}`, `Total ${formatCents(result.total)}`);
  return rows.join("\n");
}
