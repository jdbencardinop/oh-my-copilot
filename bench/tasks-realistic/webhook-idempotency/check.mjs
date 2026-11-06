import assert from "node:assert/strict";
import { assertUnchanged, load } from "../_lib/check.mjs";

assertUnchanged(import.meta.url, ["test/credit.test.mjs"]);
const { LedgerStore } = await load("src/store.mjs");
const { processCredit } = await load("src/credit.mjs");
const event = (tenantId, eventId, accountId, amountCents) => ({ tenantId, eventId, accountId, amountCents });

const store = new LedgerStore();
store.seed("alpha", "account", 100);
const duplicate = event("alpha", "retry-1", "account", 25);
const results = await Promise.all(Array.from({ length: 8 }, () => processCredit(store, duplicate)));
assert.equal(results.filter((result) => result.status === "applied").length, 1, "concurrent duplicates must apply once");
assert.equal(results.filter((result) => result.status === "duplicate").length, 7);
assert.equal(store.balance("alpha", "account"), 125);

await Promise.all(Array.from({ length: 10 }, (_, i) => processCredit(store, event("alpha", `distinct-${i}`, "account", i + 1))));
assert.equal(store.balance("alpha", "account"), 180, "different overlapping credits must not overwrite one another");
assert.deepEqual(await processCredit(store, event("beta", "retry-1", "account", 7)), { status: "applied", balance: 7 }, "event IDs are tenant-scoped");
await assert.rejects(processCredit(store, event("alpha", "retry-1", "other", 25)), { code: "EVENT_CONFLICT" });
await assert.rejects(processCredit(store, event("alpha", "retry-1", "account", 26)), { code: "EVENT_CONFLICT" });
assert.equal(store.balance("alpha", "account"), 180);
assert.equal(store.balance("alpha", "other"), 0);

for (const invalid of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
  await assert.rejects(processCredit(store, event("alpha", `invalid-${invalid}`, "account", invalid)));
}
await assert.rejects(processCredit(store, event("", "event", "account", 1)));
store.seed("overflow", "account", Number.MAX_SAFE_INTEGER);
await assert.rejects(processCredit(store, event("overflow", "too-large", "account", 1)));
assert.equal(store.balance("overflow", "account"), Number.MAX_SAFE_INTEGER);

let failOnce = true;
store.beforeCommit = async () => {
  if (failOnce) {
    failOnce = false;
    throw new Error("storage temporarily unavailable");
  }
};
const retry = event("recover", "event", "account", 11);
await assert.rejects(processCredit(store, retry), /storage temporarily unavailable/);
assert.equal(store.balance("recover", "account"), 0, "failed commits must roll back");
assert.deepEqual(await processCredit(store, retry), { status: "applied", balance: 11 }, "a failed event must remain retriable");

let release;
let started;
const blocked = new Promise((resolve) => { release = resolve; });
const inHook = new Promise((resolve) => { started = resolve; });
store.beforeCommit = async (tenantId) => {
  if (tenantId === "slow") {
    started();
    await blocked;
  }
};
const slow = processCredit(store, event("slow", "e", "account", 3));
await inHook;
let timer;
try {
  const quick = await Promise.race([
    processCredit(store, event("fast", "e", "account", 5)),
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("another tenant was blocked")), 1000); }),
  ]);
  assert.deepEqual(quick, { status: "applied", balance: 5 }, "one tenant's transaction must not block another");
} finally {
  clearTimeout(timer);
  release();
  await slow;
}
console.log("ok");
