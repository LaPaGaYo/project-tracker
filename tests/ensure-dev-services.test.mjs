import assert from "node:assert/strict";
import test from "node:test";

import { ensureDevServices } from "../scripts/ensure-dev-services.mjs";

test("reuses existing services when both configured ports are already reachable", async () => {
  const commands = [];

  const result = await ensureDevServices({
    postgresPort: 5433,
    redisPort: 6380,
    checkPort: async () => true,
    runCompose: async (args) => {
      commands.push(args);
    },
    log: () => {}
  });

  assert.deepEqual(commands, []);
  assert.equal(result.mode, "reuse");
});

test("starts docker compose when either configured port is unavailable", async () => {
  const commands = [];

  const result = await ensureDevServices({
    postgresPort: 5433,
    redisPort: 6380,
    checkPort: async (port) => port === 6380,
    runCompose: async (args) => {
      commands.push(args);
    },
    log: () => {}
  });

  assert.deepEqual(commands, [["up", "-d", "postgres", "redis"]]);
  assert.equal(result.mode, "compose");
});
