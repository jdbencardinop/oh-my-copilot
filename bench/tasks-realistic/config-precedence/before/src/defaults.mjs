export const defaults = {
  cache: { enabled: true, ttlSeconds: 60 },
  http: { timeoutMs: 2000, headers: { accept: "application/json", "x-client": "desk" } },
  labels: ["default"],
  note: "standard",
};
