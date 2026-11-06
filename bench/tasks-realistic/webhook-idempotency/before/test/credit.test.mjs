import assert from "node:assert/strict";
import test from "node:test";
import { processCredit } from "../src/credit.mjs";
import { LedgerStore } from "../src/store.mjs";

test("records and recognizes a sequential credit", async () => {
  const store = new LedgerStore();
  store.seed("t", "a", 100);
  const event = { tenantId: "t", eventId: "e", accountId: "a", amountCents: 25 };
  assert.deepEqual(await processCredit(store, event), { status: "applied", balance: 125 });
  assert.deepEqual(await processCredit(store, event), { status: "duplicate", balance: 125 });
});
