import { percentOf } from "./pricing.mjs";

// Fixed-amount coupons customers can type in at checkout.
export const COUPONS = {
  TENOFF: { code: "TENOFF", amountCents: 1000, minSpendCents: 1000 },
  FIVEOFF: { code: "FIVEOFF", amountCents: 500, minSpendCents: 0 },
  BIGSPENDER: { code: "BIGSPENDER", amountCents: 2500, minSpendCents: 15000 },
  EXPIRED20: { code: "EXPIRED20", amountCents: 2000, minSpendCents: 0, expires: "2020-01-01" },
};

// Site-wide percentage promotions.
export const PROMOTIONS = {
  SPRING25: { id: "SPRING25", percent: 25 },
  MEMBER10: { id: "MEMBER10", percent: 10 },
};

export function findCoupon(code) {
  return COUPONS[code.trim().toUpperCase()] ?? null;
}

// Minimum spend is checked against the subtotal before any discount.
export function isCouponValid(coupon, subtotalCents, today) {
  if (coupon.expires && today >= coupon.expires) return false;
  return subtotalCents >= coupon.minSpendCents;
}

/**
 * Applies percentage promotions first (each to the amount left after the
 * previous ones), then fixed coupons. Returns one line per applied discount.
 */
export function computeDiscounts(subtotalCents, promotions, coupons, today) {
  const lines = [];
  let remaining = subtotalCents;
  for (const promo of promotions) {
    const off = percentOf(remaining, promo.percent);
    remaining -= off;
    lines.push({ label: promo.id, amountCents: off });
  }
  const seen = new Set();
  for (const coupon of coupons) {
    if (seen.has(coupon.code) || !isCouponValid(coupon, subtotalCents, today)) continue;
    seen.add(coupon.code);
    const off = Math.min(coupon.amountCents, remaining);
    remaining -= off;
    lines.push({ label: coupon.code, amountCents: off });
  }
  return lines;
}
