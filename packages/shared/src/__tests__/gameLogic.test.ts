import { describe, expect, it } from "vitest";
import {
  applyMove,
  checkWinner,
  EMPTY_BOARD,
  getAvailableMoves,
  getGameStatus,
  getNextTurn,
  getWinningCells,
  isValidMove,
} from "../gameLogic";
import type { Board } from "../types";

describe("gameLogic", () => {
  describe("isValidMove", () => {
    it("allows moves on empty cells", () => {
      expect(isValidMove(EMPTY_BOARD, 0)).toBe(true);
      expect(isValidMove(EMPTY_BOARD, 4)).toBe(true);
      expect(isValidMove(EMPTY_BOARD, 8)).toBe(true);
    });

    it("rejects moves on occupied cells", () => {
      const board = applyMove(EMPTY_BOARD, 4, "X");
      expect(isValidMove(board, 4)).toBe(false);
    });

    it("rejects out-of-bounds positions", () => {
      expect(isValidMove(EMPTY_BOARD, -1)).toBe(false);
      expect(isValidMove(EMPTY_BOARD, 9)).toBe(false);
    });
  });

  describe("checkWinner", () => {
    it("detects row wins", () => {
      const board: Board = ["X", "X", "X", "O", "O", null, null, null, null];
      expect(checkWinner(board)).toBe("X");
    });

    it("detects column wins", () => {
      const board: Board = ["O", "X", null, "O", "X", null, "O", null, null];
      expect(checkWinner(board)).toBe("O");
    });

    it("detects diagonal wins", () => {
      const board: Board = ["X", "O", null, null, "X", "O", null, null, "X"];
      expect(checkWinner(board)).toBe("X");
    });

    it("returns null for no winner", () => {
      expect(checkWinner(EMPTY_BOARD)).toBe(null);
    });
  });

  describe("getWinningCells", () => {
    it("returns winning cell indices", () => {
      const board: Board = ["X", "X", "X", "O", "O", null, null, null, null];
      expect(getWinningCells(board)).toEqual([0, 1, 2]);
    });
  });

  describe("getGameStatus", () => {
    it("returns in_progress for active game", () => {
      expect(getGameStatus(EMPTY_BOARD)).toBe("in_progress");
    });

    it("returns draw for full board with no winner", () => {
      const board: Board = ["X", "O", "X", "X", "O", "O", "O", "X", "X"];
      expect(getGameStatus(board)).toBe("draw");
    });

    it("returns x_wins when X wins", () => {
      const board: Board = ["X", "X", "X", "O", "O", null, null, null, null];
      expect(getGameStatus(board)).toBe("x_wins");
    });
  });

  describe("getNextTurn", () => {
    it("alternates turns", () => {
      expect(getNextTurn("X")).toBe("O");
      expect(getNextTurn("O")).toBe("X");
    });
  });

  describe("getAvailableMoves", () => {
    it("returns all positions for empty board", () => {
      expect(getAvailableMoves(EMPTY_BOARD)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    });

    it("excludes occupied positions", () => {
      const board = applyMove(EMPTY_BOARD, 4, "X");
      expect(getAvailableMoves(board)).toEqual([0, 1, 2, 3, 5, 6, 7, 8]);
    });
  });
});
