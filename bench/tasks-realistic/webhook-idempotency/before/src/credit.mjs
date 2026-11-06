export async function processCredit(store, { tenantId, eventId, accountId, amountCents }) {
  if (![tenantId, eventId, accountId].every((id) => typeof id === "string" && id.length > 0)) {
    throw new TypeError("IDs must be nonempty strings");
  }
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw new TypeError("amountCents must be a positive safe integer");
  }
  return store.transaction(tenantId, async (draft) => {
    const balance = draft.balances.get(accountId) ?? 0;
    if (draft.events.has(eventId)) return { status: "duplicate", balance };
    await Promise.resolve();
    const updated = balance + amountCents;
    draft.balances.set(accountId, updated);
    draft.events.set(eventId, { accountId, amountCents });
    return { status: "applied", balance: updated };
  });
}
