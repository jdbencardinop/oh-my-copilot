import assert from "node:assert/strict";
import { assertUnchanged, load } from "../_lib/check.mjs";

assertUnchanged(import.meta.url, ["test/records.test.mjs", "src/orders.mjs"]);
const { readRecords } = await load("src/read-records.mjs");
const { readOrders } = await load("src/orders.mjs");
const collect = async (chunks) => {
  const values = [];
  for await (const value of readRecords(chunks)) values.push(value);
  return values;
};

const bytes = Buffer.from('{"type":"order","id":"café-猫","total":3}\r\n\nfalse\r\n{"name":"último"}', "utf8");
const expected = [{ type: "order", id: "café-猫", total: 3 }, false, { name: "último" }];
assert.deepEqual(await collect(Array.from(bytes, (byte) => Uint8Array.of(byte))), expected, "single-byte chunks must preserve UTF-8 and the final record");
assert.deepEqual(await collect([bytes]), expected);
for (let split = 0; split <= bytes.length; split++) {
  assert.deepEqual(await collect([bytes.subarray(0, split), new Uint8Array(), bytes.subarray(split)]), expected, `split at byte ${split}`);
}
assert.deepEqual(await collect([Buffer.from(" \r\n\n")]), []);
assert.deepEqual(await collect([]), []);
assert.deepEqual(await readOrders([bytes]), [{ id: "café-猫", total: 3 }], "the existing adapter must still work");

await assert.rejects(collect([Buffer.from('\n{"ok":1}\nnot-json\n')]), /line 3/i, "JSON errors must identify their line including blank lines");
await assert.rejects(collect([Buffer.from([0x7b, 0x22, 0x78, 0x22, 0x3a, 0x22, 0xc3, 0x28, 0x22, 0x7d])]), "invalid UTF-8 must reject");

async function* sourceError() {
  yield Buffer.from('{"ok":1}\n');
  throw new Error("source failed");
}
await assert.rejects(collect(sourceError()), /source failed/);

let pulls = 0;
async function* streamingSource() {
  pulls++;
  yield Buffer.from('{"first":true}\n');
  pulls++;
  throw new Error("must not read ahead");
}
const iterator = readRecords(streamingSource());
assert.deepEqual(await iterator.next(), { value: { first: true }, done: false }, "the first record must be available before EOF");
await iterator.return();
assert.equal(pulls, 1, "stopping the consumer must not pull the next chunk");
console.log("ok");
