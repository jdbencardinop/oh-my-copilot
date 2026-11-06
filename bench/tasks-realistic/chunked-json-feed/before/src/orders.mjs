import { readRecords } from "./read-records.mjs";

export async function readOrders(chunks) {
  const orders = [];
  for await (const record of readRecords(chunks)) {
    if (record?.type === "order") orders.push({ id: record.id, total: record.total });
  }
  return orders;
}
