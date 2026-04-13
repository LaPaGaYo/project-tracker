import Redis from "ioredis";

export const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6380";

export function createRedisClient() {
  return new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1
  });
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
