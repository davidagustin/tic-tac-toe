#!/usr/bin/env npx tsx

import { REDIS_KEYS } from "@ttt/shared";
import { getRedis } from "../src/lib/redis";

async function main() {
  console.log("[flush-chat] Starting chat cleanup...");

  const redis = getRedis();

  try {
    // Delete lobby chat
    const lobbyDeleted = await redis.del(REDIS_KEYS.LOBBY_CHAT);
    console.log(`[flush-chat] Deleted lobby chat: ${lobbyDeleted ? "YES" : "NONE"}`);

    // Scan for all room chat keys
    let cursor = "0";
    let totalRoomChats = 0;
    const pattern = `${REDIS_KEYS.ROOM_CHAT}*`;

    do {
      const [nextCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = nextCursor;

      if (keys.length > 0) {
        const deleted = await redis.del(...keys);
        totalRoomChats += deleted;
        console.log(`[flush-chat] Deleted ${deleted} room chat keys`);
      }
    } while (cursor !== "0");

    console.log(`[flush-chat] Total room chats deleted: ${totalRoomChats}`);
    console.log("[flush-chat] Chat cleanup complete!");
  } catch (error) {
    console.error("[flush-chat] Error:", error);
    process.exit(1);
  } finally {
    await redis.quit();
    process.exit(0);
  }
}

main();
