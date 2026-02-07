import Redis from "ioredis";
import { config } from "./config";

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 200, 2000);
        return delay;
      },
    });

    redis.on("error", (err) => {
      console.error("[Redis] Connection error:", err.message);
    });

    redis.on("connect", () => {
      console.log("[Redis] Connected");
    });
  }
  return redis;
}

export function createRedisPub(): Redis {
  return new Redis(config.REDIS_URL);
}

export function createRedisSub(): Redis {
  return new Redis(config.REDIS_URL);
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
