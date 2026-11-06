export class LedgerStore {
  constructor() {
    this.tenants = new Map();
    this.beforeCommit = undefined;
    this.queues = new Map();
  }

  seed(tenantId, accountId, balance) {
    const state = this.tenants.get(tenantId) ?? { balances: new Map(), events: new Map() };
    state.balances.set(accountId, balance);
    this.tenants.set(tenantId, state);
  }

  balance(tenantId, accountId) {
    return this.tenants.get(tenantId)?.balances.get(accountId) ?? 0;
  }

  async transaction(tenantId, action) {
    const previous = this.queues.get(tenantId) ?? Promise.resolve();
    let release;
    const tail = new Promise((resolve) => { release = resolve; });
    this.queues.set(tenantId, tail);
    await previous;
    try {
      const current = this.tenants.get(tenantId) ?? { balances: new Map(), events: new Map() };
      const draft = { balances: new Map(current.balances), events: new Map(current.events) };
      const result = await action(draft);
      if (this.beforeCommit) await this.beforeCommit(tenantId);
      this.tenants.set(tenantId, draft);
      return result;
    } finally {
      if (this.queues.get(tenantId) === tail) this.queues.delete(tenantId);
      release();
    }
  }
}
