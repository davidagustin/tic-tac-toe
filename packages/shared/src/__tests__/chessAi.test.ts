import { describe, expect, it } from "vitest";
import { evaluateBoard, getChessAiMove } from "../ai/chessAi";

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

// Mid-game position after 1.e4 e5 2.Nf3 Nc6
const MID_GAME_FEN = "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3";

// White queen on d5 is hanging (undefended), black to move can capture with pawn
// FEN: white has queen on d5, black pawn on e6 can capture
const HANGING_QUEEN_FEN = "rnbqkbnr/pppp1ppp/4p3/3Q4/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 2";

// White has extra queen (normal start but black missing queen)
const WHITE_EXTRA_QUEEN_FEN = "rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

// Black has extra queen (normal start but white missing queen)
const BLACK_EXTRA_QUEEN_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNB1KBNR w KQkq - 0 1";

describe("chessAi", () => {
  describe("easy", () => {
    it("returns a legal move from the starting position", () => {
      const result = getChessAiMove(STARTING_FEN, "easy");
      expect(result.from).toBeTruthy();
      expect(result.to).toBeTruthy();
      expect(typeof result.from).toBe("string");
      expect(typeof result.to).toBe("string");
    });

    it("returns a legal move from a mid-game position", () => {
      const result = getChessAiMove(MID_GAME_FEN, "easy");
      expect(result.from).toBeTruthy();
      expect(result.to).toBeTruthy();
    });
  });

  describe("medium", () => {
    it("prefers capturing an undefended queen over a random move", () => {
      // Medium picks randomly from top 3 scored moves.
      // Queen capture scores ~890, so it's always in the top 3.
      // With 1/3 probability per trial, use enough trials for reliable detection.
      let capturedQueen = 0;
      const trials = 60;

      for (let i = 0; i < trials; i++) {
        const result = getChessAiMove(HANGING_QUEEN_FEN, "medium");
        // The best move is exd5 (e6 captures d5 queen)
        if (result.to === "d5") {
          capturedQueen++;
        }
      }

      // With 1/3 probability, expected ~20 hits out of 60. Threshold of 10 is conservative.
      expect(capturedQueen).toBeGreaterThanOrEqual(10);
    });
  });

  describe("hard", () => {
    it("finds mate-in-1", () => {
      // In this position, it's black's turn but white already has Qxf7# delivered
      // Let's use a proper white-to-move mate-in-1 instead
      // Scholar's mate setup: White Qf3, Bc4, black hasn't defended f7
      const mateIn1FenWhite = "r1bqkbnr/pppppppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 3";
      const result = getChessAiMove(mateIn1FenWhite, "hard");
      // Qxf7# is the mating move
      expect(result.to).toBe("f7");
    });

    it("completes within 2 seconds from starting position", () => {
      const start = Date.now();
      getChessAiMove(STARTING_FEN, "hard");
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(2000);
    });
  });

  describe("evaluateBoard", () => {
    it("returns approximately 0 for the starting position", () => {
      const score = evaluateBoard(STARTING_FEN);
      expect(Math.abs(score)).toBeLessThanOrEqual(50);
    });

    it("returns positive when white has an extra queen", () => {
      const score = evaluateBoard(WHITE_EXTRA_QUEEN_FEN);
      expect(score).toBeGreaterThan(0);
    });

    it("returns negative when black has an extra queen", () => {
      const score = evaluateBoard(BLACK_EXTRA_QUEEN_FEN);
      expect(score).toBeLessThan(0);
    });
  });
});
