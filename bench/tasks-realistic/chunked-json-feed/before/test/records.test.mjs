import assert from "node:assert/strict";
import test from "node:test";
import { readOrders } from "../src/orders.mjs";

test("reads a complete order line", async () => {
  const chunks = [Buffer.from('{"type":"order","id":"a","total":10}\n')];
  assert.deepEqual(await readOrders(chunks), [{ id: "a", total: 10 }]);
});
