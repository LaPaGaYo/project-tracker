import Redis, { type RedisOptions } from "ioredis";

export const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6380";

const defaultRedisOptions = {
  lazyConnect: true,
  maxRetriesPerRequest: 1
} satisfies Pick<RedisOptions, "lazyConnect" | "maxRetriesPerRequest">;

export function buildRedisOptions(url: string): RedisOptions {
  const parsed = new URL(url);

  if (parsed.protocol !== "redis:" && parsed.protocol !== "rediss:") {
    throw new Error(`Unsupported Redis protocol: ${parsed.protocol}`);
  }

  const options: RedisOptions = {
    ...defaultRedisOptions,
    host: parsed.hostname || "localhost",
    port: parsed.port ? Number(parsed.port) : 6379
  };

  if (parsed.username) {
    options.username = decodeURIComponent(parsed.username);
  }

  if (parsed.password) {
    options.password = decodeURIComponent(parsed.password);
  }

  if (parsed.pathname.length > 1) {
    const db = Number(parsed.pathname.slice(1));

    if (Number.isInteger(db) && db >= 0) {
      options.db = db;
    }
  }

  if (parsed.protocol === "rediss:") {
    options.tls = {};
  }

  return options;
}

export function createRedisClient() {
  return new Redis(buildRedisOptions(redisUrl));
}

export const redis = createRedisClient();

export async function connectRedis(client: Redis = redis) {
  if (client.status === "wait") {
    await client.connect();
  }

  return client;
}

export async function closeRedis(client: Redis = redis) {
  if (client.status === "wait") {
    client.disconnect();
    return;
  }

  if (client.status !== "end") {
    await client.quit();
  }
}
