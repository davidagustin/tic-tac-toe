import type { ClientToServerEvents, ServerToClientEvents } from "@ttt/shared";
import { REDIS_KEYS } from "@ttt/shared";
import type { Socket } from "socket.io";
import { getRedis } from "../lib/redis";
import type { TypedServer } from "../plugins/socketio";
import { getChatHistory, sendMessage } from "../services/chat";
import { listRooms } from "../services/room";

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export function registerLobbyHandlers(io: TypedServer, socket: TypedSocket) {
  socket.on("lobby:join", async () => {
    await socket.join("lobby");

    const redis = getRedis();

    // Track online users
    await redis.sadd(REDIS_KEYS.LOBBY_ONLINE, socket.data.userId);

    // Send current rooms
    const rooms = await listRooms();
    socket.emit("lobby:rooms", rooms);

    // Send chat history
    const history = await getChatHistory("lobby", null);
    socket.emit("lobby:chat_history", history);

    // Broadcast online count
    const count = await redis.scard(REDIS_KEYS.LOBBY_ONLINE);
    io.to("lobby").emit("lobby:online_count", count);
  });

  socket.on("lobby:leave", async () => {
    await socket.leave("lobby");
    await handleLobbyDisconnect(io, socket);
  });

  socket.on("lobby:chat", async ({ text }) => {
    const message = await sendMessage(
      "lobby",
      null,
      socket.data.userId,
      socket.data.userName,
      text,
    );

    if (message) {
      io.to("lobby").emit("lobby:chat", message);
    }
  });

  // Clean up on disconnect
  socket.on("disconnect", async () => {
    await handleLobbyDisconnect(io, socket);
  });
}

async function handleLobbyDisconnect(io: TypedServer, socket: TypedSocket) {
  const redis = getRedis();
  await redis.srem(REDIS_KEYS.LOBBY_ONLINE, socket.data.userId);
  const count = await redis.scard(REDIS_KEYS.LOBBY_ONLINE);
  io.to("lobby").emit("lobby:online_count", count);
}
