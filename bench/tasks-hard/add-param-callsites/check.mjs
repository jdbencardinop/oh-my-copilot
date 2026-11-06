import { eq, fail, load, read, throws } from "../_lib/check.mjs";

const money = await load("money.mjs");
const invoice = await load("invoice.mjs");
const cart = await load("cart.mjs");
const receipt = await load("receipt.mjs");

eq(money.formatPrice(123456, "EUR"), "€1,234.56", "formatPrice EUR");
eq(money.formatPrice(5000, "JPY"), "¥5,000", "formatPrice JPY");
throws(() => money.formatPrice(100), "formatPrice without a currency");
eq(money.formatMinor(-250, "GBP"), "-£2.50", "formatMinor");
eq(money.sumLines([{ unitPrice: 250, quantity: 3 }]), 750, "sumLines");

const inv = {
  number: "INV-7",
  currency: "EUR",
  taxRate: 0.2,
  lines: [
    { description: "Widget", unitPrice: 1250, quantity: 4 },
    { description: "Gadget", unitPrice: 99, quantity: 1 },
  ],
};
eq(invoice.invoiceLines(inv), ["Widget x4 @ €12.50 = €50.00", "Gadget x1 @ €0.99 = €0.99"], "invoiceLines");
eq(invoice.invoiceTotal(inv), ["Subtotal: €50.99", "Tax: €10.20", "Total: €61.19"], "invoiceTotal");
eq(invoice.overdueNotice(inv, { lateFee: 1500, billingCurrency: "GBP" }), "Invoice INV-7 is overdue. A late fee of £15.00 has been added.", "overdueNotice");

const c = { currency: "GBP", items: [{ unitPrice: 1999, quantity: 2 }] };
eq(cart.cartSummary(c), "1 items, £39.98", "cartSummary");
eq(cart.freeShippingHint(c, 5000), "Add £10.02 more for free shipping.", "freeShippingHint");
eq(cart.freeShippingHint(c, 100), "You qualify for free shipping.", "freeShippingHint (qualifies)");
eq(cart.shippingLabel(c, { name: "Osaka", currency: "JPY", shippingCost: 1200 }), "Shipping to Osaka: ¥1,200", "shippingLabel");

const locale = { storeName: "Corner Shop", currency: "USD" };
const order = {
  id: 42,
  currency: "EUR",
  payments: [
    { method: "card", amount: 3000, currency: "EUR" },
    { method: "voucher", amount: 500, currency: "GBP" },
  ],
};
eq(receipt.receiptHeader(order, locale), "Corner Shop - order 42", "receiptHeader");
eq(receipt.receiptPayment(order, locale), ["card: €30.00", "voucher: £5.00", "Paid: €35.00"], "receiptPayment");
eq(receipt.receiptRefund(order, locale, { amount: 700, method: "card", currency: "JPY" }), "Corner Shop refunded ¥700 to card.", "receiptRefund");

for (const f of ["invoice.mjs", "cart.mjs", "receipt.mjs"]) {
  if (/formatPrice\([^,()]*(\([^()]*\))?[^,()]*\)/.test(read(f))) fail(`${f} still has a one-argument formatPrice call`);
}
console.log("ok");
