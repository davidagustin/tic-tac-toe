import type { RoomDetail, RoomInfo, RoomMember } from "@ttt/shared";
import { REDIS_KEYS, ROOM_CONFIG } from "@ttt/shared";
import { nanoid } from "nanoid";
import { getRedis } from "../lib/redis";

export type RedisRoom = RoomDetail & { passwordHash?: string };

// ─── Room CRUD ────────────────────────────────────────

export async function createRoom(
  name: string,
  host: { userId: string; userName: string; rating: number },
  passwordHash?: string,
): Promise<RoomDetail> {
  const redis = getRedis();
  const roomId = nanoid(ROOM_CONFIG.ROOM_CODE_LENGTH);
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + ROOM_CONFIG.ROOM_TTL_SECONDS * 1000).toISOString();

  const hostMember: RoomMember = {
    userId: host.userId,
    name: host.userName,
    rating: host.rating,
    role: "player",
    isReady: false,
    isConnected: true,
    mark: "X",
  };

  const room: RoomDetail = {
    id: roomId,
    name,
    hostId: host.userId,
    hasPassword: !!passwordHash,
    status: "waiting",
    players: [hostMember],
    spectators: [],
    createdAt: now,
    expiresAt,
  };

  const pipeline = redis.pipeline();

  // Store room data
  pipeline.set(
    REDIS_KEYS.ROOM + roomId,
    JSON.stringify({ ...room, passwordHash }),
    "EX",
    ROOM_CONFIG.ROOM_TTL_SECONDS,
  );

  // Add to rooms set
  pipeline.sadd(REDIS_KEYS.ROOM_LIST, roomId);

  // Track user → room mapping
  pipeline.set(REDIS_KEYS.USER_ROOM + host.userId, roomId, "EX", ROOM_CONFIG.ROOM_TTL_SECONDS);

  await pipeline.exec();

  return room;
}

export async function getRoom(roomId: string): Promise<RedisRoom | null> {
  const redis = getRedis();
  const data = await redis.get(REDIS_KEYS.ROOM + roomId);
  if (!data) return null;
  return JSON.parse(data);
}

export async function saveRoom(room: RedisRoom): Promise<void> {
  const redis = getRedis();
  const ttl = await redis.ttl(REDIS_KEYS.ROOM + room.id);
  const effectiveTtl = ttl > 0 ? ttl : ROOM_CONFIG.ROOM_TTL_SECONDS;
  await redis.set(REDIS_KEYS.ROOM + room.id, JSON.stringify(room), "EX", effectiveTtl);
}

export async function deleteRoom(roomId: string): Promise<void> {
  const redis = getRedis();
  const room = await getRoom(roomId);

  const pipeline = redis.pipeline();
  pipeline.del(REDIS_KEYS.ROOM + roomId);
  pipeline.srem(REDIS_KEYS.ROOM_LIST, roomId);
  pipeline.del(REDIS_KEYS.ROOM_CHAT + roomId);
  pipeline.del(REDIS_KEYS.GAME_STATE + roomId);

  // Clear user→room mappings for all members
  if (room) {
    for (const member of [...room.players, ...room.spectators]) {
      pipeline.del(REDIS_KEYS.USER_ROOM + member.userId);
    }
  }

  await pipeline.exec();
}

export async function listRooms(): Promise<RoomInfo[]> {
  const redis = getRedis();
  const roomIds = await redis.smembers(REDIS_KEYS.ROOM_LIST);

  if (roomIds.length === 0) return [];

  const pipeline = redis.pipeline();
  for (const id of roomIds) {
    pipeline.get(REDIS_KEYS.ROOM + id);
  }
  const results = await pipeline.exec();
  if (!results) return [];

  const rooms: RoomInfo[] = [];
  const expiredIds: string[] = [];

  for (let i = 0; i < results.length; i++) {
    const [err, data] = results[i];
    if (err || !data) {
      expiredIds.push(roomIds[i]);
      continue;
    }
    const room: RoomDetail = JSON.parse(data as string);
    rooms.push(toRoomInfo(room));
  }

  // Clean up expired room IDs from the set
  if (expiredIds.length > 0) {
    await redis.srem(REDIS_KEYS.ROOM_LIST, ...expiredIds);
  }

  return rooms;
}

export async function addMemberToRoom(
  roomId: string,
  member: RoomMember,
): Promise<{ success: boolean; error?: string; room?: RoomDetail }> {
  const room = await getRoom(roomId);
  if (!room) return { success: false, error: "Room not found" };

  const totalMembers = room.players.length + room.spectators.length;
  if (totalMembers >= ROOM_CONFIG.MAX_TOTAL) {
    return { success: false, error: "Room is full" };
  }

  // Check if already in room
  const existing = [...room.players, ...room.spectators].find((m) => m.userId === member.userId);
  if (existing) {
    existing.isConnected = true;
    await saveRoom(room);
    return { success: true, room };
  }

  if (room.players.length < ROOM_CONFIG.MAX_PLAYERS && room.status === "waiting") {
    member.role = "player";
    member.mark = "O"; // host is always X
    room.players.push(member);
  } else if (room.spectators.length < ROOM_CONFIG.MAX_SPECTATORS) {
    member.role = "spectator";
    member.mark = undefined;
    room.spectators.push(member);
  } else {
    return { success: false, error: "Room is full" };
  }

  // Track user → room
  const redis = getRedis();
  await redis.set(REDIS_KEYS.USER_ROOM + member.userId, roomId, "EX", ROOM_CONFIG.ROOM_TTL_SECONDS);

  await saveRoom(room);
  return { success: true, room };
}

export async function removeMemberFromRoom(
  roomId: string,
  userId: string,
): Promise<{ room: RedisRoom | null; deleted: boolean; newHostId?: string }> {
  const room = await getRoom(roomId);
  if (!room) return { room: null, deleted: true };

  room.players = room.players.filter((m) => m.userId !== userId);
  room.spectators = room.spectators.filter((m) => m.userId !== userId);

  const redis = getRedis();
  await redis.del(REDIS_KEYS.USER_ROOM + userId);

  const totalMembers = room.players.length + room.spectators.length;

  if (totalMembers === 0) {
    await deleteRoom(roomId);
    return { room: null, deleted: true };
  }

  // Transfer host if host left
  let newHostId: string | undefined;
  if (room.hostId === userId) {
    const newHost = room.players[0] || room.spectators[0];
    room.hostId = newHost.userId;
    newHostId = newHost.userId;

    // If a spectator becomes host and there's a player slot, promote them
    if (room.players.length === 0 && room.spectators.length > 0) {
      const promoted = room.spectators.shift()!;
      promoted.role = "player";
      promoted.mark = "X";
      room.players.push(promoted);
    }
  }

  // Reassign marks if a player left
  if (room.players.length === 1) {
    room.players[0].mark = "X";
    room.players[0].isReady = false;
    // Promote first spectator to player slot if available
    if (room.spectators.length > 0 && room.status === "waiting") {
      const promoted = room.spectators.shift()!;
      promoted.role = "player";
      promoted.mark = "O";
      promoted.isReady = false;
      room.players.push(promoted);
    }
  }

  await saveRoom(room);
  return { room, deleted: false, newHostId };
}

export async function getUserRoom(userId: string): Promise<string | null> {
  const redis = getRedis();
  return redis.get(REDIS_KEYS.USER_ROOM + userId);
}

export async function setPlayerReady(
  roomId: string,
  userId: string,
): Promise<{ allReady: boolean; room: RoomDetail | null }> {
  const room = await getRoom(roomId);
  if (!room) return { allReady: false, room: null };

  const player = room.players.find((m) => m.userId === userId);
  if (!player) return { allReady: false, room };

  player.isReady = !player.isReady;
  await saveRoom(room);

  const allReady =
    room.players.length === ROOM_CONFIG.MAX_PLAYERS && room.players.every((p) => p.isReady);

  return { allReady, room };
}

// ─── Helpers ──────────────────────────────────────────

function toRoomInfo(room: RoomDetail): RoomInfo {
  return {
    id: room.id,
    name: room.name,
    hostId: room.hostId,
    hostName: room.players.find((p) => p.userId === room.hostId)?.name || "Unknown",
    hasPassword: room.hasPassword,
    playerCount: room.players.length,
    spectatorCount: room.spectators.length,
    maxPlayers: ROOM_CONFIG.MAX_PLAYERS,
    maxSpectators: ROOM_CONFIG.MAX_SPECTATORS,
    status: room.status,
    createdAt: room.createdAt,
  };
}

export { toRoomInfo };
