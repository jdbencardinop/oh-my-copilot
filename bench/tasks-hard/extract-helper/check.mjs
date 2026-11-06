import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { count, eq, fail, functionText, load, read, taskDir } from "../_lib/check.mjs";

const dir = taskDir(import.meta.url);
const text = read("validators.mjs");
const m = await load("validators.mjs");
const orig = await import(pathToFileURL(join(dir, "before", "validators.mjs")).href);

if (typeof m.requiredFieldErrors !== "function") fail("requiredFieldErrors is not exported");
eq(m.requiredFieldErrors({ a: 1, b: " ", c: null, e: 0, f: false }, ["a", "b", "c", "d", "e", "f"], "thing"),
  ["thing.b is required", "thing.c is required", "thing.d is required"], "requiredFieldErrors");
eq(m.requiredFieldErrors({}, [], "x"), [], "requiredFieldErrors with no fields");

for (const name of ["validateCustomer", "validateOrder", "validateProduct", "validateShipment"]) {
  const body = functionText(text, name);
  if (!body) fail(`${name} not found`);
  if (!/\brequiredFieldErrors\(/.test(body)) fail(`${name} does not call requiredFieldErrors`);
  if (/value\.trim\(\) === ""/.test(body)) fail(`${name} still has its own required-field loop`);
}
if (count(text, /value\.trim\(\) === ""/) > 1) fail("the required-field check is still duplicated");
if (count(text, /is required`/) > 1) fail("the required-field message is still duplicated");

const records = [
  {},
  { id: 1, name: "Ada", email: "ada@example.com" },
  { id: 1, name: "  ", email: "not-an-email" },
  { id: 0, name: "Bo", email: "" },
  { id: null, customerId: "c1", items: [] },
  { id: "o1", customerId: "c1", items: [{ quantity: 2 }, { quantity: 0 }] },
  { id: "o2", items: "x" },
  { kind: "service", sku: "abc-1", name: "Thing", priceCents: -5 },
  { kind: "product", sku: "ABC-1234", name: "Thing", priceCents: 1999 },
  { sku: "", name: "\t", priceCents: 1.5 },
  { id: "s1", orderId: "o1", address: "Main St 1", carrier: "UPS" },
  { id: "s2", orderId: "o1", address: "", carrier: "pigeon" },
  { id: "s3", orderId: undefined, address: "x", carrier: false },
];
for (const name of ["validateCustomer", "validateOrder", "validateProduct", "validateShipment"]) {
  for (const r of records) eq(m[name](r), orig[name](r), `${name}(${JSON.stringify(r)})`);
}
const batch = records.map((data, i) => ({ type: ["customer", "order", "product", "shipment", "unknown"][i % 5], data }));
eq(m.validateBatch(batch), orig.validateBatch(batch), "validateBatch");
console.log("ok");
