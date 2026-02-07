import type { ChatMessage } from "@ttt/shared";
import { CHAT_CONFIG, REDIS_KEYS } from "@ttt/shared";
import { nanoid } from "nanoid";
import { getRedis } from "../lib/redis";

export async function sendMessage(
  channel: "lobby" | "room",
  channelId: string | null, // null for lobby, roomId for room
  userId: string,
  userName: string,
  text: string,
): Promise<ChatMessage | null> {
  if (text.length === 0 || text.length > CHAT_CONFIG.MAX_MESSAGE_LENGTH) {
    return null;
  }

  // Rate limiting
  const isAllowed = await checkRateLimit(userId);
  if (!isAllowed) return null;

  const redis = getRedis();
  const key = channel === "lobby" ? REDIS_KEYS.LOBBY_CHAT : REDIS_KEYS.ROOM_CHAT + channelId;

  const message: ChatMessage = {
    id: nanoid(12),
    userId,
    userName,
    text: text.trim(),
    timestamp: new Date().toISOString(),
    channel,
  };

  const pipeline = redis.pipeline();
  pipeline.rpush(key, JSON.stringify(message));
  pipeline.ltrim(key, -CHAT_CONFIG.MAX_HISTORY, -1); // Keep last N messages
  pipeline.expire(key, CHAT_CONFIG.MESSAGE_TTL_SECONDS);
  await pipeline.exec();

  return message;
}

export async function getChatHistory(
  channel: "lobby" | "room",
  channelId: string | null,
): Promise<ChatMessage[]> {
  const redis = getRedis();
  const key = channel === "lobby" ? REDIS_KEYS.LOBBY_CHAT : REDIS_KEYS.ROOM_CHAT + channelId;

  const messages = await redis.lrange(key, 0, -1);
  return messages.map((m) => JSON.parse(m));
}

async function checkRateLimit(userId: string): Promise<boolean> {
  const redis = getRedis();
  const key = REDIS_KEYS.CHAT_RATE + userId;

  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, CHAT_CONFIG.RATE_LIMIT_WINDOW_SECONDS);
  }

  return count <= CHAT_CONFIG.RATE_LIMIT_MESSAGES;
}
