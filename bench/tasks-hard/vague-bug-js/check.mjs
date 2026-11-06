import { eq, fail, load } from "../_lib/check.mjs";

const { checkout, receipt } = await load("cart.mjs");
const item = (priceCents, quantity = 1) => ({ sku: `sku-${priceCents}`, priceCents, quantity });

function run(items, opts, expected, what) {
  const r = checkout({ items }, opts);
  const lines = r.discountLines.map((l) => [l.label, l.amountCents]);
  eq({ lines, discount: r.discount, tax: r.tax, total: r.total }, expected, what);
  const sum = r.discountLines.reduce((a, l) => a + l.amountCents, 0);
  if (sum !== r.discount) fail(`${what}: discount lines add up to ${sum}, not ${r.discount}`);
  if (r.total < 0 || r.tax < 0) fail(`${what}: negative total or tax`);
  return r;
}

const r = run([item(1200)], { couponCodes: ["TENOFF"], promotionIds: ["SPRING25"], taxRatePercent: 8 },
  { lines: [["SPRING25", 300], ["TENOFF", 900]], discount: 1200, tax: 0, total: 0 }, "promotion + coupon over the remaining amount");
eq(receipt(r), "Subtotal $12.00\nSPRING25 -$3.00\nTENOFF -$9.00\nTax $0.00\nTotal $0.00", "receipt");

run([item(1200)], { couponCodes: ["TENOFF", "FIVEOFF"], taxRatePercent: 10 },
  { lines: [["TENOFF", 1000], ["FIVEOFF", 200]], discount: 1200, tax: 0, total: 0 }, "two coupons over the subtotal");
run([item(300)], { couponCodes: ["FIVEOFF"] },
  { lines: [["FIVEOFF", 300]], discount: 300, tax: 0, total: 0 }, "coupon larger than the subtotal");
run([item(2500, 2)], { couponCodes: ["TENOFF"], promotionIds: ["SPRING25"], taxRatePercent: 8 },
  { lines: [["SPRING25", 1250], ["TENOFF", 1000]], discount: 2250, tax: 220, total: 2970 }, "promotion + coupon, no overflow");
run([item(10000)], { promotionIds: ["MEMBER10", "SPRING25"] },
  { lines: [["MEMBER10", 1000], ["SPRING25", 2250]], discount: 3250, tax: 0, total: 6750 }, "stacked promotions");
run([item(500)], { couponCodes: ["TENOFF"], taxRatePercent: 10 },
  { lines: [], discount: 0, tax: 50, total: 550 }, "coupon below minimum spend");
run([item(16000)], { couponCodes: ["BIGSPENDER", "EXPIRED20"], promotionIds: ["SPRING25"] },
  { lines: [["SPRING25", 4000], ["BIGSPENDER", 2500]], discount: 6500, tax: 0, total: 9500 }, "min spend uses the undiscounted subtotal; expired coupon");
run([item(999, 3)], { couponCodes: ["tenoff", "TENOFF "], taxRatePercent: 5 },
  { lines: [["TENOFF", 1000]], discount: 1000, tax: 100, total: 2097 }, "duplicate coupon codes");
run([item(1999)], {}, { lines: [], discount: 0, tax: 0, total: 1999 }, "no discounts");
console.log("ok");
