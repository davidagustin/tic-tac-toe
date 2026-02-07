import type { ClientToServerEvents, RoomMember, ServerToClientEvents } from "@ttt/shared";
import { GAME_CONFIG, ROOM_CONFIG } from "@ttt/shared";
import bcrypt from "bcryptjs";
import type { Socket } from "socket.io";
import type { TypedServer } from "../plugins/socketio";
import { getChatHistory, sendMessage } from "../services/chat";
import { createGameState } from "../services/game";
import {
  addMemberToRoom,
  createRoom,
  getRoom,
  getUserRoom,
  removeMemberFromRoom,
  saveRoom,
  setPlayerReady,
  toRoomInfo,
} from "../services/room";

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export function registerRoomHandlers(io: TypedServer, socket: TypedSocket) {
  socket.on("room:create", async ({ name, password }, callback) => {
    // Guests cannot create rooms
    if (socket.data.isGuest) {
      return callback({ success: false, error: "Guests cannot create rooms. Please sign up!" });
    }

    // Validate room name
    const trimmedName = name.trim();
    if (trimmedName.length === 0 || trimmedName.length > ROOM_CONFIG.MAX_NAME_LENGTH) {
      return callback({ success: false, error: "Invalid room name" });
    }

    // Check if user is already in a room
    const existingRoom = await getUserRoom(socket.data.userId);
    if (existingRoom) {
      return callback({ success: false, error: "You are already in a room" });
    }

    let passwordHash: string | undefined;
    if (password) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    const room = await createRoom(
      trimmedName,
      {
        userId: socket.data.userId,
        userName: socket.data.userName,
        rating: socket.data.rating || 1000,
      },
      passwordHash,
    );

    // Join Socket.IO room
    await socket.join(`room:${room.id}`);

    // Notify lobby of new room
    io.to("lobby").emit("lobby:room_added", toRoomInfo(room));

    callback({ success: true, roomId: room.id });
  });

  socket.on("room:join", async ({ roomId, password }, callback) => {
    // Check if user is already in a room
    const existingRoom = await getUserRoom(socket.data.userId);
    if (existingRoom && existingRoom !== roomId) {
      return callback({ success: false, error: "You are already in another room" });
    }

    const room = await getRoom(roomId);
    if (!room) {
      return callback({ success: false, error: "Room not found" });
    }

    // Password check
    if (room.passwordHash) {
      if (!password) {
        return callback({ success: false, error: "Password required" });
      }
      const valid = await bcrypt.compare(password, room.passwordHash);
      if (!valid) {
        return callback({ success: false, error: "Wrong password" });
      }
    }

    const member: RoomMember = {
      userId: socket.data.userId,
      name: socket.data.userName,
      rating: socket.data.rating || 1000,
      role: "spectator", // addMemberToRoom will assign proper role
      isReady: false,
      isConnected: true,
    };

    const result = await addMemberToRoom(roomId, member);
    if (!result.success) {
      return callback({ success: false, error: result.error });
    }

    // Join Socket.IO room
    await socket.join(`room:${roomId}`);

    // Send room state to new member
    const { passwordHash: _, ...cleanRoom } = (await getRoom(roomId))!;
    socket.emit("room:state", cleanRoom);

    // Send room chat history
    const chatHistory = await getChatHistory("room", roomId);
    socket.emit("room:chat_history", chatHistory);

    // Find the member in the updated room (to get their assigned role)
    const updatedMember = [...cleanRoom.players, ...cleanRoom.spectators].find(
      (m) => m.userId === socket.data.userId,
    );

    // Notify others in the room
    if (updatedMember) {
      socket.to(`room:${roomId}`).emit("room:player_joined", updatedMember);
    }

    // Update lobby room info
    io.to("lobby").emit("lobby:room_updated", toRoomInfo(cleanRoom));

    callback({ success: true });
  });

  socket.on("room:leave", async () => {
    await handleRoomLeave(io, socket);
  });

  socket.on("room:ready", async () => {
    const roomId = await getUserRoom(socket.data.userId);
    if (!roomId) return;

    const { allReady, room } = await setPlayerReady(roomId, socket.data.userId);
    if (!room) return;

    const player = room.players.find((p) => p.userId === socket.data.userId);
    if (player) {
      io.to(`room:${roomId}`).emit("room:player_ready", {
        userId: socket.data.userId,
        isReady: player.isReady,
      });
    }

    // If both players ready, start countdown → game
    if (allReady) {
      let countdown = GAME_CONFIG.COUNTDOWN_SECONDS;

      const interval = setInterval(async () => {
        io.to(`room:${roomId}`).emit("room:countdown", countdown);
        countdown--;

        if (countdown < 0) {
          clearInterval(interval);

          // Start the game
          const latestRoom = await getRoom(roomId);
          if (!latestRoom) return;

          latestRoom.status = "playing";
          await saveRoom(latestRoom);

          const gameState = await createGameState(latestRoom);

          io.to(`room:${roomId}`).emit("game:state", gameState);

          // Update lobby
          io.to("lobby").emit("lobby:room_updated", toRoomInfo(latestRoom));
        }
      }, 1000);
    }
  });

  socket.on("room:kick", async ({ userId }) => {
    const roomId = await getUserRoom(socket.data.userId);
    if (!roomId) return;

    const room = await getRoom(roomId);
    if (!room) return;

    // Only host can kick
    if (room.hostId !== socket.data.userId) return;
    // Can't kick yourself
    if (userId === socket.data.userId) return;

    // Find the target socket and emit kick event
    const sockets = await io.in(`room:${roomId}`).fetchSockets();
    for (const s of sockets) {
      if (s.data.userId === userId) {
        s.emit("room:kicked", { reason: "Kicked by host" });
        await s.leave(`room:${roomId}`);
        break;
      }
    }

    // Remove from room data
    const result = await removeMemberFromRoom(roomId, userId);
    if (result.room) {
      io.to(`room:${roomId}`).emit("room:player_left", { userId });
      io.to("lobby").emit("lobby:room_updated", toRoomInfo(result.room));
    }
  });

  socket.on("room:chat", async ({ text }) => {
    const roomId = await getUserRoom(socket.data.userId);
    if (!roomId) return;

    const message = await sendMessage(
      "room",
      roomId,
      socket.data.userId,
      socket.data.userName,
      text,
    );

    if (message) {
      io.to(`room:${roomId}`).emit("room:chat", message);
    }
  });

  // Handle disconnect — leave room
  socket.on("disconnect", async () => {
    await handleRoomLeave(io, socket);
  });
}

async function handleRoomLeave(io: TypedServer, socket: TypedSocket) {
  const roomId = await getUserRoom(socket.data.userId);
  if (!roomId) return;

  await socket.leave(`room:${roomId}`);

  const result = await removeMemberFromRoom(roomId, socket.data.userId);

  if (result.deleted) {
    // Room was empty and deleted
    io.to("lobby").emit("lobby:room_removed", roomId);
  } else if (result.room) {
    io.to(`room:${roomId}`).emit("room:player_left", {
      userId: socket.data.userId,
      newHostId: result.newHostId,
    });

    // Send updated room state to remaining members
    const { passwordHash: _, ...cleanRoom } = result.room;
    io.to(`room:${roomId}`).emit("room:state", cleanRoom);

    io.to("lobby").emit("lobby:room_updated", toRoomInfo(result.room));
  }
}
