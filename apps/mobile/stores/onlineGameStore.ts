import type { Board, GameStatus, OnlineGameState, Player } from "@ttt/shared";
import { create } from "zustand";

interface OnlineGameStoreState {
  gameState: OnlineGameState | null;
  myMark: Player | null;
  isMyTurn: boolean;
  winningCells: number[] | null;
  rematchOfferedBy: string | null;
  iOfferedRematch: boolean;

  setGameState: (state: OnlineGameState, myUserId: string) => void;
  applyMove: (position: number, player: Player, nextTurn: Player, board: Board) => void;
  setGameOver: (winner: Player | null, finalBoard: Board, winningCells: number[] | null) => void;
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
    const myMark: Player | null =
      state.playerX.userId === myUserId ? "X" : state.playerO.userId === myUserId ? "O" : null;

    set({
      gameState: state,
      myMark,
      isMyTurn: myMark === state.currentTurn,
      winningCells: null,
      rematchOfferedBy: null,
      iOfferedRematch: false,
    });
  },

  applyMove: (_position, _player, nextTurn, board) =>
    set((state) => {
      if (!state.gameState) return state;
      return {
        gameState: {
          ...state.gameState,
          board,
          currentTurn: nextTurn,
        },
        isMyTurn: state.myMark === nextTurn,
      };
    }),

  setGameOver: (winner, finalBoard, winningCells) =>
    set((state) => {
      if (!state.gameState) return state;
      const status: GameStatus = winner === "X" ? "x_wins" : winner === "O" ? "o_wins" : "draw";

      return {
        gameState: {
          ...state.gameState,
          board: finalBoard,
          status,
        },
        isMyTurn: false,
        winningCells,
      };
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
