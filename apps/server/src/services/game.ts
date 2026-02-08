import type {
  ChessOnlineGameState,
  GameType,
  OnlineGameState,
  RoomDetail,
  TttOnlineGameState,
} from "@ttt/shared";
import { REDIS_KEYS, ROOM_CONFIG } from "@ttt/shared";
import { prisma } from "../lib/prisma";
import { getRedis } from "../lib/redis";
import { getEngine } from "./engines/registry";
import type { MoveResult } from "./engines/types";
import { updateRatingsAfterGame } from "./rating";

// ─── Game State in Redis ──────────────────────────────

export async function createGameState(room: RoomDetail): Promise<OnlineGameState> {
  const engine = getEngine(room.gameType);
  const state = engine.createGameState(room);

  const redis = getRedis();
  await redis.set(
    REDIS_KEYS.GAME_STATE + room.id,
    JSON.stringify(state),
    "EX",
    ROOM_CONFIG.ROOM_TTL_SECONDS,
  );

  return state;
}

export async function getGameState(roomId: string): Promise<OnlineGameState | null> {
  const redis = getRedis();
  const data = await redis.get(REDIS_KEYS.GAME_STATE + roomId);
  if (!data) return null;
  return JSON.parse(data);
}

export async function saveGameState(state: OnlineGameState): Promise<void> {
  const redis = getRedis();
  await redis.set(
    REDIS_KEYS.GAME_STATE + state.roomId,
    JSON.stringify(state),
    "EX",
    ROOM_CONFIG.ROOM_TTL_SECONDS,
  );
}

// ─── Move Processing ──────────────────────────────────

export async function processMove(
  roomId: string,
  userId: string,
  movePayload: unknown,
): Promise<MoveResult> {
  const state = await getGameState(roomId);
  if (!state) return { success: false, error: "No active game" };

  const engine = getEngine(state.gameType);
  const result = engine.processMove(state, userId, movePayload);

  if (result.success && result.state) {
    await saveGameState(result.state);
  }

  return result;
}

// ─── Forfeit ──────────────────────────────────────────

export async function processForfeit(roomId: string, userId: string): Promise<MoveResult> {
  const state = await getGameState(roomId);
  if (!state) return { success: false };

  const engine = getEngine(state.gameType);
  const result = engine.processForfeit(state, userId);

  if (result.success && result.state) {
    await saveGameState(result.state);
  }

  return result;
}

// ─── Persist to Prisma ────────────────────────────────

export async function persistCompletedGame(state: OnlineGameState): Promise<void> {
  const isTtt = state.gameType === "tic_tac_toe";
  const tttState = isTtt ? (state as TttOnlineGameState) : null;
  const chessState = !isTtt ? (state as ChessOnlineGameState) : null;

  const player1Id = tttState ? tttState.playerX.userId : chessState!.playerWhite.userId;
  const player2Id = tttState ? tttState.playerO.userId : chessState!.playerBlack.userId;

  const p1IsGuest = player1Id.startsWith("guest_");
  const p2IsGuest = player2Id.startsWith("guest_");
  if (p1IsGuest && p2IsGuest) return;

  try {
    // Determine winner user ID
    let winnerId: string | undefined;
    if (isTtt) {
      if (state.status === "x_wins") winnerId = player1Id;
      else if (state.status === "o_wins") winnerId = player2Id;
    } else {
      if (state.status === "white_wins") winnerId = player1Id;
      else if (state.status === "black_wins") winnerId = player2Id;
    }

    const statusMap: Record<string, string> = {
      x_wins: "X_WINS",
      o_wins: "O_WINS",
      draw: "DRAW",
      abandoned: "ABANDONED",
      white_wins: "WHITE_WINS",
      black_wins: "BLACK_WINS",
    };

    const prismaStatus = statusMap[state.status] as
      | "X_WINS"
      | "O_WINS"
      | "DRAW"
      | "ABANDONED"
      | "WHITE_WINS"
      | "BLACK_WINS"
      | undefined;
    if (!prismaStatus) return;

    const prismaGameType = isTtt ? "TIC_TAC_TOE" : "CHESS";

    // Build moves data
    const movesData = isTtt
      ? tttState!.moves.map((m) => ({
          player: m.player as "X" | "O",
          position: m.position,
          moveNum: m.moveNum,
        }))
      : chessState!.moves.map((m) => ({
          player: m.color === "white" ? ("WHITE" as const) : ("BLACK" as const),
          moveNum: m.moveNum,
          fromSquare: m.from,
          toSquare: m.to,
          san: m.san,
          promotion: m.promotion,
        }));

    await prisma.game.create({
      data: {
        playerXId: p1IsGuest ? undefined! : player1Id,
        playerOId: p2IsGuest ? undefined : player2Id,
        winnerId: winnerId && !winnerId.startsWith("guest_") ? winnerId : undefined,
        roomId: state.roomId,
        gameType: prismaGameType,
        status: prismaStatus,
        startedAt: new Date(state.startedAt),
        endedAt: new Date(),
        moves: {
          create: movesData,
        },
      },
    });

    // Update per-game ratings
    await updateRatingsAfterGame(
      state.gameType,
      player1Id,
      player2Id,
      winnerId && !winnerId.startsWith("guest_") ? winnerId : null,
    );
  } catch (err) {
    console.error("[Game] Failed to persist game:", err);
  }
}

// ─── Rematch ──────────────────────────────────────────

export async function createRematchState(
  _roomId: string,
  room: RoomDetail,
): Promise<OnlineGameState> {
  const currentState = await getGameState(room.id);
  const gameType = room.gameType;
  const engine = getEngine(gameType);

  const newState = engine.createRematchState(room, currentState!);

  const redis = getRedis();
  await redis.set(
    REDIS_KEYS.GAME_STATE + room.id,
    JSON.stringify(newState),
    "EX",
    ROOM_CONFIG.ROOM_TTL_SECONDS,
  );

  return newState;
}
