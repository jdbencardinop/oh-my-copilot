export async function processCredit(store, { tenantId, eventId, accountId, amountCents }) {
  if (![tenantId, eventId, accountId].every((id) => typeof id === "string" && id.length > 0)) {
    throw new TypeError("IDs must be nonempty strings");
  }
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw new TypeError("amountCents must be a positive safe integer");
  }
  return store.transaction(tenantId, async (draft) => {
    const balance = draft.balances.get(accountId) ?? 0;
    const prior = draft.events.get(eventId);
    if (prior) {
      if (prior.accountId !== accountId || prior.amountCents !== amountCents) {
        const error = new Error("event ID reused with different credit");
        error.code = "EVENT_CONFLICT";
        throw error;
      }
      return { status: "duplicate", balance };
    }
    const updated = balance + amountCents;
    if (!Number.isSafeInteger(updated)) throw new RangeError("balance exceeds safe integer range");
    draft.balances.set(accountId, updated);
    draft.events.set(eventId, { accountId, amountCents });
    return { status: "applied", balance: updated };
  });
}
