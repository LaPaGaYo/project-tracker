import assert from "node:assert/strict";
import test from "node:test";

import { buildRedisOptions } from "./redis";

void test("buildRedisOptions parses redis URLs into explicit ioredis connection options", () => {
  assert.deepEqual(
    buildRedisOptions("redis://user:secret@cache.internal:6380/4"),
    {
      host: "cache.internal",
      port: 6380,
      username: "user",
      password: "secret",
      db: 4,
      lazyConnect: true,
      maxRetriesPerRequest: 1
    }
  );
});

void test("buildRedisOptions preserves TLS for rediss URLs without delegating URL parsing", () => {
  assert.deepEqual(buildRedisOptions("rediss://cache.internal"), {
    host: "cache.internal",
    port: 6379,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    tls: {}
  });
});
