import type {
  Board,
  GameMove,
  OnlineGameState,
  Player,
  RoomDetail,
  TttOnlineGameState,
} from "@ttt/shared";
import {
  applyMove,
  checkWinner,
  getGameStatus,
  getNextTurn,
  getWinningCells,
  isBoardFull,
  isValidMove,
} from "@ttt/shared";
import type { GameEngine, MoveResult } from "./types";

function asTtt(state: OnlineGameState): TttOnlineGameState {
  if (state.gameType !== "tic_tac_toe") {
    throw new Error("Expected tic_tac_toe game state");
  }
  return state;
}

export const tttEngine: GameEngine = {
  gameType: "tic_tac_toe",

  createGameState(room: RoomDetail): TttOnlineGameState {
    const playerX = room.players.find((p) => p.mark === "X")!;
    const playerO = room.players.find((p) => p.mark === "O")!;

    return {
      gameType: "tic_tac_toe",
      roomId: room.id,
      board: Array(9).fill(null) as Board,
      currentTurn: "X",
      status: "in_progress",
      playerX,
      playerO,
      moves: [],
      startedAt: new Date().toISOString(),
    };
  },

  processMove(state: OnlineGameState, userId: string, movePayload: unknown): MoveResult {
    const tttState = asTtt(state);
    const payload = movePayload as { position: number };
    const position = payload.position;

    if (tttState.status !== "in_progress") {
      return { success: false, error: "Game is not in progress" };
    }

    const currentPlayer = tttState.currentTurn === "X" ? tttState.playerX : tttState.playerO;
    if (currentPlayer.userId !== userId) {
      return { success: false, error: "Not your turn" };
    }

    if (!isValidMove(tttState.board, position)) {
      return { success: false, error: "Invalid move" };
    }

    tttState.board = applyMove(tttState.board, position, tttState.currentTurn);

    const move: GameMove = {
      player: tttState.currentTurn,
      position,
      moveNum: tttState.moves.length + 1,
      timestamp: new Date().toISOString(),
    };
    tttState.moves.push(move);

    const winner = checkWinner(tttState.board);
    const winningCells = getWinningCells(tttState.board);
    const gameOver = winner !== null || isBoardFull(tttState.board);

    const previousTurn = tttState.currentTurn;

    if (gameOver) {
      tttState.status = getGameStatus(tttState.board);
    } else {
      tttState.currentTurn = getNextTurn(tttState.currentTurn);
    }

    const result: MoveResult = {
      success: true,
      state: tttState,
      gameOver,
      movedPayload: {
        gameType: "tic_tac_toe",
        position,
        player: previousTurn,
        nextTurn: tttState.currentTurn,
        board: tttState.board,
      },
    };

    if (gameOver) {
      result.gameOverPayload = {
        gameType: "tic_tac_toe",
        winner: winner as Player | null,
        reason: winner ? `${winner} wins!` : "Draw!",
        finalBoard: tttState.board,
        winningCells: winningCells ?? null,
      };
    }

    return result;
  },

  processForfeit(state: OnlineGameState, userId: string): MoveResult {
    const tttState = asTtt(state);

    if (tttState.status !== "in_progress") {
      return { success: false };
    }

    let winner: Player | null = null;

    if (tttState.playerX.userId === userId) {
      tttState.status = "o_wins";
      winner = "O";
    } else if (tttState.playerO.userId === userId) {
      tttState.status = "x_wins";
      winner = "X";
    } else {
      return { success: false };
    }

    return {
      success: true,
      state: tttState,
      gameOver: true,
      gameOverPayload: {
        gameType: "tic_tac_toe",
        winner,
        reason: "Forfeit",
        finalBoard: tttState.board,
        winningCells: null,
      },
    };
  },

  createRematchState(room: RoomDetail, _previousState: OnlineGameState): TttOnlineGameState {
    // Swap marks for rematch
    for (const player of room.players) {
      player.mark = player.mark === "X" ? "O" : "X";
    }
    return this.createGameState(room) as TttOnlineGameState;
  },
};
