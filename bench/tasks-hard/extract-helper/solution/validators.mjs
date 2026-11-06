// Input validation for the import API. Each validator returns a list of
// human-readable problems; an empty list means the record is valid.

const EMAIL = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;
const SKU = /^[A-Z]{3}-\d{4}$/;
const CARRIERS = new Set(["dhl", "ups", "fedex", "postnl"]);

/**
 * Lists a "<prefix>.<field> is required" problem for every field of `fields`
 * that is missing, null or a blank string in `record`.
 */
export function requiredFieldErrors(record, fields, prefix) {
  const errors = [];
  for (const field of fields) {
    const value = record[field];
    if (value === undefined || value === null || (typeof value === "string" && value.trim() === "")) {
      errors.push(`${prefix}.${field} is required`);
    }
  }
  return errors;
}

export function validateCustomer(record) {
  const errors = [];
  errors.push(...requiredFieldErrors(record, ["id", "name", "email"], "customer"));
  if (typeof record.email === "string" && record.email.trim() !== "" && !EMAIL.test(record.email)) {
    errors.push("customer.email is not a valid address");
  }
  return errors;
}

export function validateOrder(record) {
  const errors = [];
  errors.push(...requiredFieldErrors(record, ["id", "customerId", "items"], "order"));
  if (Array.isArray(record.items)) {
    if (record.items.length === 0) errors.push("order.items must not be empty");
    record.items.forEach((item, i) => {
      if (!Number.isInteger(item.quantity) || item.quantity < 1) errors.push(`order.items[${i}].quantity must be a positive integer`);
    });
  }
  return errors;
}

export function validateProduct(record) {
  const errors = [];
  if (record.kind !== undefined && record.kind !== "product") {
    errors.push(`product.kind must be "product", got "${record.kind}"`);
  }
  errors.push(...requiredFieldErrors(record, ["sku", "name", "priceCents"], "product"));
  if (typeof record.sku === "string" && record.sku !== "" && !SKU.test(record.sku)) errors.push("product.sku must look like ABC-1234");
  if (record.priceCents != null && (!Number.isInteger(record.priceCents) || record.priceCents < 0)) {
    errors.push("product.priceCents must be a non-negative integer");
  }
  return errors;
}

export function validateShipment(record) {
  const errors = [];
  errors.push(...requiredFieldErrors(record, ["id", "orderId", "address", "carrier"], "shipment"));
  if (record.carrier && !CARRIERS.has(String(record.carrier).toLowerCase())) {
    errors.push(`shipment.carrier "${record.carrier}" is not supported`);
  }
  return errors;
}

export function validateBatch(records) {
  const validators = { customer: validateCustomer, order: validateOrder, product: validateProduct, shipment: validateShipment };
  return records.flatMap((entry, i) => {
    const validate = validators[entry.type];
    if (!validate) return [`records[${i}]: unknown type "${entry.type}"`];
    return validate(entry.data).map((problem) => `records[${i}]: ${problem}`);
  });
}
