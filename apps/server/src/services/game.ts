import type { GameMove, OnlineGameState, Player, RoomDetail } from "@ttt/shared";
import {
  applyMove,
  checkWinner,
  GAME_CONFIG,
  getGameStatus,
  getNextTurn,
  getWinningCells,
  isBoardFull,
  isValidMove,
  REDIS_KEYS,
  ROOM_CONFIG,
} from "@ttt/shared";
import { prisma } from "../lib/prisma";
import { getRedis } from "../lib/redis";

// ─── ELO Rating ──────────────────────────────────────

function calculateElo(
  playerRating: number,
  opponentRating: number,
  actualScore: number, // 1 = win, 0 = loss, 0.5 = draw
): number {
  const expected = 1 / (1 + 10 ** ((opponentRating - playerRating) / 400));
  return Math.round(playerRating + GAME_CONFIG.RATING_K_FACTOR * (actualScore - expected));
}

// ─── Game State in Redis ──────────────────────────────

export async function createGameState(room: RoomDetail): Promise<OnlineGameState> {
  const playerX = room.players.find((p) => p.mark === "X")!;
  const playerO = room.players.find((p) => p.mark === "O")!;

  const state: OnlineGameState = {
    roomId: room.id,
    board: Array(9).fill(null),
    currentTurn: "X",
    status: "in_progress",
    playerX,
    playerO,
    moves: [],
    startedAt: new Date().toISOString(),
  };

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
  position: number,
): Promise<{
  success: boolean;
  error?: string;
  state?: OnlineGameState;
  gameOver?: boolean;
  winner?: Player | null;
  winningCells?: number[] | null;
}> {
  const state = await getGameState(roomId);
  if (!state) return { success: false, error: "No active game" };

  if (state.status !== "in_progress") {
    return { success: false, error: "Game is not in progress" };
  }

  // Verify it's this player's turn
  const currentPlayer = state.currentTurn === "X" ? state.playerX : state.playerO;
  if (currentPlayer.userId !== userId) {
    return { success: false, error: "Not your turn" };
  }

  // Validate move
  if (!isValidMove(state.board, position)) {
    return { success: false, error: "Invalid move" };
  }

  // Apply move
  state.board = applyMove(state.board, position, state.currentTurn);

  const move: GameMove = {
    player: state.currentTurn,
    position,
    moveNum: state.moves.length + 1,
    timestamp: new Date().toISOString(),
  };
  state.moves.push(move);

  // Check game status
  const winner = checkWinner(state.board);
  const winningCells = getWinningCells(state.board);
  const gameOver = winner !== null || isBoardFull(state.board);

  if (gameOver) {
    state.status = getGameStatus(state.board);
  } else {
    state.currentTurn = getNextTurn(state.currentTurn);
  }

  await saveGameState(state);

  return { success: true, state, gameOver, winner, winningCells };
}

// ─── Forfeit ──────────────────────────────────────────

export async function processForfeit(
  roomId: string,
  userId: string,
): Promise<{
  success: boolean;
  state?: OnlineGameState;
  winner?: Player | null;
}> {
  const state = await getGameState(roomId);
  if (!state) return { success: false };

  if (state.status !== "in_progress") return { success: false };

  // The player who forfeits loses
  if (state.playerX.userId === userId) {
    state.status = "o_wins";
  } else if (state.playerO.userId === userId) {
    state.status = "x_wins";
  } else {
    return { success: false };
  }

  const winner: Player | null =
    state.status === "x_wins" ? "X" : state.status === "o_wins" ? "O" : null;

  await saveGameState(state);

  return { success: true, state, winner };
}

// ─── Persist to Prisma ────────────────────────────────

export async function persistCompletedGame(state: OnlineGameState): Promise<void> {
  // Skip persistence for guest-only games
  const xIsGuest = state.playerX.userId.startsWith("guest_");
  const oIsGuest = state.playerO.userId.startsWith("guest_");
  if (xIsGuest && oIsGuest) return;

  try {
    const winner = checkWinner(state.board);
    let winnerId: string | undefined;

    if (winner === "X") winnerId = state.playerX.userId;
    else if (winner === "O") winnerId = state.playerO.userId;

    const statusMap: Record<string, "X_WINS" | "O_WINS" | "DRAW" | "ABANDONED"> = {
      x_wins: "X_WINS",
      o_wins: "O_WINS",
      draw: "DRAW",
      abandoned: "ABANDONED",
    };

    const prismaStatus = statusMap[state.status];
    if (!prismaStatus) return;

    // Create game record
    await prisma.game.create({
      data: {
        playerXId: xIsGuest ? undefined! : state.playerX.userId,
        playerOId: oIsGuest ? undefined : state.playerO.userId,
        winnerId: winnerId && !winnerId.startsWith("guest_") ? winnerId : undefined,
        roomId: state.roomId,
        status: prismaStatus,
        startedAt: new Date(state.startedAt),
        endedAt: new Date(),
        moves: {
          create: state.moves.map((m) => ({
            player: m.player,
            position: m.position,
            moveNum: m.moveNum,
          })),
        },
      },
    });

    // Fetch current ratings for ELO calculation
    const xRating = xIsGuest
      ? GAME_CONFIG.INITIAL_RATING
      : ((
          await prisma.user.findUnique({
            where: { id: state.playerX.userId },
            select: { rating: true },
          })
        )?.rating ?? GAME_CONFIG.INITIAL_RATING);
    const oRating = oIsGuest
      ? GAME_CONFIG.INITIAL_RATING
      : ((
          await prisma.user.findUnique({
            where: { id: state.playerO.userId },
            select: { rating: true },
          })
        )?.rating ?? GAME_CONFIG.INITIAL_RATING);

    const xScore = winner === "X" ? 1 : winner === "O" ? 0 : 0.5;
    const oScore = 1 - xScore;

    const newXRating = calculateElo(xRating, oRating, xScore);
    const newORating = calculateElo(oRating, xRating, oScore);

    // Update user stats and rating for non-guest players
    const updates: Promise<any>[] = [];

    if (!xIsGuest) {
      updates.push(
        prisma.user.update({
          where: { id: state.playerX.userId },
          data: {
            gamesPlayed: { increment: 1 },
            rating: newXRating,
            ...(winner === "X"
              ? { wins: { increment: 1 } }
              : winner === "O"
                ? { losses: { increment: 1 } }
                : { draws: { increment: 1 } }),
          },
        }),
      );
    }

    if (!oIsGuest) {
      updates.push(
        prisma.user.update({
          where: { id: state.playerO.userId },
          data: {
            gamesPlayed: { increment: 1 },
            rating: newORating,
            ...(winner === "O"
              ? { wins: { increment: 1 } }
              : winner === "X"
                ? { losses: { increment: 1 } }
                : { draws: { increment: 1 } }),
          },
        }),
      );
    }

    await Promise.all(updates);
  } catch (err) {
    console.error("[Game] Failed to persist game:", err);
  }
}

// ─── Rematch ──────────────────────────────────────────

export async function createRematchState(
  _roomId: string,
  room: RoomDetail,
): Promise<OnlineGameState> {
  // Swap marks for rematch
  for (const player of room.players) {
    player.mark = player.mark === "X" ? "O" : "X";
    player.isReady = false;
  }

  return createGameState(room);
}
