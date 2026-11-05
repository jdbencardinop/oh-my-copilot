// oh-my-copilot extension entry point.
//
// This file only holds the kill switch. Feature code loads afterwards with a
// dynamic import, so OMC_DISABLE=1 works even if a feature module is broken.

import { joinSession } from "@github/copilot-sdk/extension";

const disabled = /^(1|true|yes|on)$/i.test((process.env.OMC_DISABLE ?? "").trim());

if (disabled) {
  // Join with nothing: no tools, hooks, or commands. Copilot runs as normal.
  await joinSession({});
} else {
  let joined = false;
  const join = (config) => {
    joined = true;
    return joinSession(config);
  };
  try {
    const { start } = await import("./lib/main.mjs");
    await start(join);
  } catch (err) {
    process.stderr.write(`[oh-my-copilot] startup failed: ${err?.stack ?? err}\n`);
    if (!joined) {
      const session = await joinSession({});
      await session
        .log(`oh-my-copilot failed to start and is inactive: ${err?.message ?? err}`, { level: "warning" })
        .catch(() => {});
    }
  }
}
