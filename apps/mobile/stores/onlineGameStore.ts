import type {
  Board,
  ChessColor,
  GameOverPayload,
  GameStatus,
  OnlineGameState,
  Player,
  PlayerSide,
} from "@ttt/shared";
import { create } from "zustand";

interface OnlineGameStoreState {
  gameState: OnlineGameState | null;
  myMark: PlayerSide | null;
  isMyTurn: boolean;
  winningCells: number[] | null;
  rematchOfferedBy: string | null;
  iOfferedRematch: boolean;

  setGameState: (state: OnlineGameState, myUserId: string) => void;
  applyTttMove: (position: number, player: Player, nextTurn: Player, board: Board) => void;
  applyChessMove: (
    fen: string,
    nextTurn: ChessColor,
    isCheck: boolean,
    from: string,
    to: string,
  ) => void;
  setGameOver: (payload: GameOverPayload) => void;
  setRematchOffered: (userId: string) => void;
  setIOfferedRematch: (offered: boolean) => void;
  reset: () => void;
}

export const useOnlineGameStore = create<OnlineGameStoreState>((set) => ({
  gameState: null,
  myMark: null,
  isMyTurn: false,
  winningCells: null,
  rematchOfferedBy: null,
  iOfferedRematch: false,

  setGameState: (state, myUserId) => {
    let myMark: PlayerSide | null = null;

    if (state.gameType === "tic_tac_toe") {
      if (state.playerX.userId === myUserId) myMark = "X";
      else if (state.playerO.userId === myUserId) myMark = "O";
    } else {
      if (state.playerWhite.userId === myUserId) myMark = "white";
      else if (state.playerBlack.userId === myUserId) myMark = "black";
    }

    const isMyTurn =
      state.gameType === "tic_tac_toe"
        ? myMark === state.currentTurn
        : myMark === state.currentTurn;

    set({
      gameState: state,
      myMark,
      isMyTurn,
      winningCells: null,
      rematchOfferedBy: null,
      iOfferedRematch: false,
    });
  },

  applyTttMove: (_position, _player, nextTurn, board) =>
    set((s) => {
      if (!s.gameState || s.gameState.gameType !== "tic_tac_toe") return s;
      return {
        gameState: {
          ...s.gameState,
          board,
          currentTurn: nextTurn,
        },
        isMyTurn: s.myMark === nextTurn,
      };
    }),

  applyChessMove: (fen, nextTurn, isCheck, from, to) =>
    set((s) => {
      if (!s.gameState || s.gameState.gameType !== "chess") return s;
      return {
        gameState: {
          ...s.gameState,
          fen,
          currentTurn: nextTurn,
          isCheck,
          lastMove: { from, to },
        },
        isMyTurn: s.myMark === nextTurn,
      };
    }),

  setGameOver: (payload) =>
    set((s) => {
      if (!s.gameState) return s;

      if (payload.gameType === "tic_tac_toe" && s.gameState.gameType === "tic_tac_toe") {
        const status: GameStatus =
          payload.winner === "X" ? "x_wins" : payload.winner === "O" ? "o_wins" : "draw";
        return {
          gameState: {
            ...s.gameState,
            board: payload.finalBoard,
            status,
          },
          isMyTurn: false,
          winningCells: payload.winningCells,
        };
      }

      if (payload.gameType === "chess" && s.gameState.gameType === "chess") {
        const status: GameStatus =
          payload.winner === "white"
            ? "white_wins"
            : payload.winner === "black"
              ? "black_wins"
              : "draw";
        return {
          gameState: {
            ...s.gameState,
            fen: payload.finalFen,
            pgn: payload.pgn,
            status,
          },
          isMyTurn: false,
        };
      }

      return s;
    }),

  setRematchOffered: (userId) => set({ rematchOfferedBy: userId }),

  setIOfferedRematch: (offered) => set({ iOfferedRematch: offered }),

  reset: () =>
    set({
      gameState: null,
      myMark: null,
      isMyTurn: false,
      winningCells: null,
      rematchOfferedBy: null,
      iOfferedRematch: false,
    }),
}));
