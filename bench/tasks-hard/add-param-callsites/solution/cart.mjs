import { formatPrice, sumLines } from "./money.mjs";

export function cartSummary(cart) {
  const subtotal = sumLines(cart.items);
  return `${cart.items.length} items, ${formatPrice(subtotal, cart.currency)}`;
}

export function freeShippingHint(cart, threshold) {
  const remaining = threshold - sumLines(cart.items);
  if (remaining <= 0) return "You qualify for free shipping.";
  return `Add ${formatPrice(remaining, cart.currency)} more for free shipping.`;
}

export function shippingLabel(cart, region) {
  const cost = region.shippingCost;
  return `Shipping to ${region.name}: ${formatPrice(cost, region.currency)}`;
}
