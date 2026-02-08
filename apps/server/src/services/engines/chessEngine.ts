import type {
  ChessColor,
  ChessGameMove,
  ChessOnlineGameState,
  GameStatus,
  OnlineGameState,
  RoomDetail,
} from "@ttt/shared";
import { CHESS_CONFIG } from "@ttt/shared";
import { Chess } from "chess.js";
import type { GameEngine, MoveResult } from "./types";

function asChess(state: OnlineGameState): ChessOnlineGameState {
  if (state.gameType !== "chess") {
    throw new Error("Expected chess game state");
  }
  return state;
}

function turnColor(chess: Chess): ChessColor {
  return chess.turn() === "w" ? "white" : "black";
}

function deriveStatus(chess: Chess): GameStatus {
  if (chess.isCheckmate()) {
    // The side whose turn it is has been checkmated — the other side wins
    return chess.turn() === "w" ? "black_wins" : "white_wins";
  }
  if (chess.isStalemate() || chess.isDraw()) {
    return "draw";
  }
  return "in_progress";
}

function getCapturedPieces(chess: Chess): { white: string[]; black: string[] } {
  // Starting piece counts: 8 pawns, 2 rooks, 2 knights, 2 bishops, 1 queen (king can't be captured)
  const starting: Record<string, number> = { p: 8, r: 2, n: 2, b: 2, q: 1 };
  const current = { white: { ...starting }, black: { ...starting } };

  for (const row of chess.board()) {
    for (const square of row) {
      if (square) {
        const color = square.color === "w" ? "white" : "black";
        const piece = square.type;
        if (piece !== "k" && current[color][piece] !== undefined) {
          current[color][piece]--;
        }
      }
    }
  }

  // Captured pieces are the ones missing from each side
  const captured: { white: string[]; black: string[] } = { white: [], black: [] };

  for (const [piece, count] of Object.entries(current.white)) {
    for (let i = 0; i < count; i++) {
      // White pieces captured means black captured them — show in black's list
      captured.black.push(
        CHESS_CONFIG.PIECE_SYMBOLS.white[piece as keyof typeof CHESS_CONFIG.PIECE_SYMBOLS.white],
      );
    }
  }
  for (const [piece, count] of Object.entries(current.black)) {
    for (let i = 0; i < count; i++) {
      captured.white.push(
        CHESS_CONFIG.PIECE_SYMBOLS.black[piece as keyof typeof CHESS_CONFIG.PIECE_SYMBOLS.black],
      );
    }
  }

  return captured;
}

export const chessEngine: GameEngine = {
  gameType: "chess",

  createGameState(room: RoomDetail): ChessOnlineGameState {
    const playerWhite = room.players.find((p) => p.mark === "white")!;
    const playerBlack = room.players.find((p) => p.mark === "black")!;

    return {
      gameType: "chess",
      roomId: room.id,
      fen: CHESS_CONFIG.INITIAL_FEN,
      pgn: "",
      currentTurn: "white",
      status: "in_progress",
      playerWhite,
      playerBlack,
      moves: [],
      startedAt: new Date().toISOString(),
      isCheck: false,
      capturedPieces: { white: [], black: [] },
    };
  },

  processMove(state: OnlineGameState, userId: string, movePayload: unknown): MoveResult {
    const chessState = asChess(state);
    const payload = movePayload as { from: string; to: string; promotion?: string };

    if (chessState.status !== "in_progress") {
      return { success: false, error: "Game is not in progress" };
    }

    const currentPlayer =
      chessState.currentTurn === "white" ? chessState.playerWhite : chessState.playerBlack;
    if (currentPlayer.userId !== userId) {
      return { success: false, error: "Not your turn" };
    }

    const chess = new Chess(chessState.fen);

    try {
      const moveResult = chess.move({
        from: payload.from,
        to: payload.to,
        promotion: payload.promotion,
      });

      if (!moveResult) {
        return { success: false, error: "Invalid move" };
      }

      const previousTurn = chessState.currentTurn;
      const move: ChessGameMove = {
        color: previousTurn,
        from: payload.from,
        to: payload.to,
        san: moveResult.san,
        promotion: payload.promotion,
        moveNum: chessState.moves.length + 1,
        timestamp: new Date().toISOString(),
      };
      chessState.moves.push(move);

      chessState.fen = chess.fen();
      chessState.pgn = chess.pgn();
      chessState.currentTurn = turnColor(chess);
      chessState.isCheck = chess.isCheck();
      chessState.lastMove = { from: payload.from, to: payload.to };
      chessState.capturedPieces = getCapturedPieces(chess);

      const status = deriveStatus(chess);
      chessState.status = status;
      const gameOver = status !== "in_progress";

      const result: MoveResult = {
        success: true,
        state: chessState,
        gameOver,
        movedPayload: {
          gameType: "chess",
          from: payload.from,
          to: payload.to,
          san: moveResult.san,
          color: previousTurn,
          nextTurn: chessState.currentTurn,
          fen: chessState.fen,
          isCheck: chessState.isCheck,
          promotion: payload.promotion,
        },
      };

      if (gameOver) {
        const winner: ChessColor | null =
          status === "white_wins" ? "white" : status === "black_wins" ? "black" : null;

        let reason = "Draw!";
        if (chess.isCheckmate()) reason = "Checkmate!";
        else if (chess.isStalemate()) reason = "Stalemate";
        else if (chess.isThreefoldRepetition()) reason = "Draw by repetition";
        else if (chess.isInsufficientMaterial()) reason = "Insufficient material";

        result.gameOverPayload = {
          gameType: "chess",
          winner,
          reason,
          finalFen: chessState.fen,
          pgn: chessState.pgn,
        };
      }

      return result;
    } catch {
      return { success: false, error: "Invalid move" };
    }
  },

  processForfeit(state: OnlineGameState, userId: string): MoveResult {
    const chessState = asChess(state);

    if (chessState.status !== "in_progress") {
      return { success: false };
    }

    let winner: ChessColor | null = null;

    if (chessState.playerWhite.userId === userId) {
      chessState.status = "black_wins";
      winner = "black";
    } else if (chessState.playerBlack.userId === userId) {
      chessState.status = "white_wins";
      winner = "white";
    } else {
      return { success: false };
    }

    return {
      success: true,
      state: chessState,
      gameOver: true,
      gameOverPayload: {
        gameType: "chess",
        winner,
        reason: "Forfeit",
        finalFen: chessState.fen,
        pgn: chessState.pgn,
      },
    };
  },

  createRematchState(room: RoomDetail, _previousState: OnlineGameState): ChessOnlineGameState {
    // Swap colors for rematch
    for (const player of room.players) {
      player.mark = player.mark === "white" ? "black" : "white";
    }
    return this.createGameState(room) as ChessOnlineGameState;
  },
};
