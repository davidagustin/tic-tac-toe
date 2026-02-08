import type { ClientToServerEvents, ServerToClientEvents } from "@ttt/shared";
import type { Socket } from "socket.io";
import type { TypedServer } from "../plugins/socketio";
import {
  createRematchState,
  persistCompletedGame,
  processForfeit,
  processMove,
} from "../services/game";
import { getRoom, getUserRoom, saveRoom, toRoomInfo } from "../services/room";

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

// Track rematch offers per room: roomId → Set of userIds who offered rematch
const rematchOffers = new Map<string, Set<string>>();

export function registerGameHandlers(io: TypedServer, socket: TypedSocket) {
  socket.on("game:move", async (movePayload) => {
    const roomId = await getUserRoom(socket.data.userId);
    if (!roomId) return;

    const result = await processMove(roomId, socket.data.userId, movePayload);

    if (!result.success) {
      socket.emit("error", { message: result.error || "Move failed", code: "INVALID_MOVE" });
      return;
    }

    if (!result.state) return;

    // Broadcast move to all in the room (engine provides the payload)
    if (result.movedPayload) {
      io.to(`room:${roomId}`).emit("game:moved", result.movedPayload);
    }

    if (result.gameOver && result.gameOverPayload) {
      io.to(`room:${roomId}`).emit("game:over", result.gameOverPayload);

      // Persist to database
      await persistCompletedGame(result.state);

      // Reset room status to waiting
      const room = await getRoom(roomId);
      if (room) {
        room.status = "waiting";
        for (const player of room.players) {
          player.isReady = false;
        }
        await saveRoom(room);
        io.to("lobby").emit("lobby:room_updated", toRoomInfo(room));
      }

      // Clear rematch offers
      rematchOffers.delete(roomId);
    }
  });

  socket.on("game:forfeit", async () => {
    const roomId = await getUserRoom(socket.data.userId);
    if (!roomId) return;

    const result = await processForfeit(roomId, socket.data.userId);

    if (result.success && result.state && result.gameOverPayload) {
      io.to(`room:${roomId}`).emit("game:over", result.gameOverPayload);

      await persistCompletedGame(result.state);

      const room = await getRoom(roomId);
      if (room) {
        room.status = "waiting";
        for (const player of room.players) {
          player.isReady = false;
        }
        await saveRoom(room);
        io.to("lobby").emit("lobby:room_updated", toRoomInfo(room));
      }

      rematchOffers.delete(roomId);
    }
  });

  socket.on("game:rematch", async () => {
    const roomId = await getUserRoom(socket.data.userId);
    if (!roomId) return;

    const room = await getRoom(roomId);
    if (!room) return;

    // Only players can request rematch
    const isPlayer = room.players.some((p) => p.userId === socket.data.userId);
    if (!isPlayer) return;

    // Track this player's rematch offer
    if (!rematchOffers.has(roomId)) {
      rematchOffers.set(roomId, new Set());
    }
    const offers = rematchOffers.get(roomId)!;
    offers.add(socket.data.userId);

    if (offers.size < 2) {
      // Notify opponent that rematch was offered
      socket.to(`room:${roomId}`).emit("game:rematch_offered", {
        userId: socket.data.userId,
      });
      return;
    }

    // Both players want rematch — start new game with swapped sides
    rematchOffers.delete(roomId);

    const newState = await createRematchState(roomId, room);
    await saveRoom(room); // Save updated marks

    room.status = "playing";
    await saveRoom(room);

    io.to(`room:${roomId}`).emit("game:rematch_start", newState);
    io.to("lobby").emit("lobby:room_updated", toRoomInfo(room));
  });
}
