import { describe, expect, it } from "vitest";
import { getTttAiMove } from "../ai/tttAi";
import {
  applyMove,
  checkWinner,
  EMPTY_BOARD,
  getAvailableMoves,
  getNextTurn,
  isBoardFull,
} from "../gameLogic";
import type { Board, Player } from "../types";

describe("tttAi", () => {
  describe("easy", () => {
    it("returns a valid position on an empty board", () => {
      const result = getTttAiMove(EMPTY_BOARD, "X", "easy");
      expect(result.position).toBeGreaterThanOrEqual(0);
      expect(result.position).toBeLessThanOrEqual(8);
      expect(EMPTY_BOARD[result.position]).toBeNull();
    });

    it("never picks an occupied cell when only one move remains", () => {
      // Board with only position 4 empty
      const board: Board = ["X", "O", "X", "O", null, "X", "O", "X", "O"];
      const result = getTttAiMove(board, "X", "easy");
      expect(result.position).toBe(4);
    });
  });

  describe("medium", () => {
    it("takes the winning move when available", () => {
      // X has top row almost complete: X, X, _
      const board: Board = ["X", "X", null, "O", "O", null, null, null, null];
      const result = getTttAiMove(board, "X", "medium");
      expect(result.position).toBe(2);
    });

    it("blocks the opponent's winning move", () => {
      // O is about to win with bottom row: O, O, _
      // AI is X, so it should block position 8
      const board: Board = ["X", null, null, null, "X", null, "O", "O", null];
      const result = getTttAiMove(board, "X", "medium");
      expect(result.position).toBe(8);
    });
  });

  describe("hard", () => {
    it("never loses as X in 100 random games", () => {
      for (let game = 0; game < 100; game++) {
        let board: Board = [...EMPTY_BOARD];
        let currentTurn: Player = "X";

        while (!checkWinner(board) && !isBoardFull(board)) {
          if (currentTurn === "X") {
            // AI plays as X (hard)
            const move = getTttAiMove(board, "X", "hard");
            board = applyMove(board, move.position, "X");
          } else {
            // Random opponent
            const available = getAvailableMoves(board);
            const randomPos = available[Math.floor(Math.random() * available.length)];
            board = applyMove(board, randomPos, "O");
          }
          currentTurn = getNextTurn(currentTurn);
        }

        const winner = checkWinner(board);
        // AI (X) should never lose
        expect(winner).not.toBe("O");
      }
    });

    it("never loses as O in 100 random games", () => {
      for (let game = 0; game < 100; game++) {
        let board: Board = [...EMPTY_BOARD];
        let currentTurn: Player = "X";

        while (!checkWinner(board) && !isBoardFull(board)) {
          if (currentTurn === "O") {
            // AI plays as O (hard)
            const move = getTttAiMove(board, "O", "hard");
            board = applyMove(board, move.position, "O");
          } else {
            // Random opponent
            const available = getAvailableMoves(board);
            const randomPos = available[Math.floor(Math.random() * available.length)];
            board = applyMove(board, randomPos, "X");
          }
          currentTurn = getNextTurn(currentTurn);
        }

        const winner = checkWinner(board);
        // AI (O) should never lose
        expect(winner).not.toBe("X");
      }
    });

    it("takes center on empty board", () => {
      const result = getTttAiMove(EMPTY_BOARD, "X", "hard");
      expect(result.position).toBe(4);
    });
  });
});
