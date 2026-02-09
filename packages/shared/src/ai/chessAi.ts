import { Chess } from "chess.js";
import { PIECE_SQUARE_TABLES, PIECE_VALUES } from "./chessEvalTables";
import type { AiDifficulty, ChessAiMoveResult } from "./types";

// ─── Public API ──────────────────────────────────────────

/**
 * Returns the AI's chosen move for chess given a FEN string
 * and the difficulty level.
 */
export function getChessAiMove(fen: string, difficulty: AiDifficulty): ChessAiMoveResult {
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true });

  if (moves.length === 0) {
    throw new Error("No legal moves available");
  }

  switch (difficulty) {
    case "easy":
      return toResult(pickRandom(moves));
    case "medium":
      return toResult(getMediumMove(chess, moves));
    case "hard":
      return toResult(getHardMove(chess));
  }
}

/**
 * Evaluates a board position from white's perspective.
 * Positive = white advantage, negative = black advantage.
 */
export function evaluateBoard(fen: string): number {
  const chess = new Chess(fen);
  return evaluate(chess);
}

// ─── Helpers ─────────────────────────────────────────────

interface VerboseMove {
  from: string;
  to: string;
  san: string;
  captured?: string;
  promotion?: string;
  flags: string;
  color: string;
  piece: string;
}

function toResult(move: VerboseMove): ChessAiMoveResult {
  const result: ChessAiMoveResult = { from: move.from, to: move.to };
  if (move.promotion) {
    result.promotion = move.promotion;
  }
  return result;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Center squares for medium scoring ───────────────────

const CENTER_SQUARES = new Set(["d4", "d5", "e4", "e5"]);

// ─── Medium: Heuristic scoring of each move ──────────────

function getMediumMove(chess: Chess, moves: VerboseMove[]): VerboseMove {
  const scored: { move: VerboseMove; score: number }[] = moves.map((move) => {
    let score = 0;

    // Captures: score by captured piece value minus a fraction of the capturing piece
    if (move.captured) {
      const capturedValue = PIECE_VALUES[move.captured] ?? 0;
      const pieceValue = PIECE_VALUES[move.piece] ?? 0;
      score += capturedValue - pieceValue * 0.1;
    }

    // Check bonus
    chess.move({ from: move.from, to: move.to, promotion: move.promotion });
    if (chess.isCheck()) {
      score += 50;
    }
    chess.undo();

    // Center control bonus
    if (CENTER_SQUARES.has(move.to)) {
      score += 30;
    }

    return { move, score };
  });

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  // Pick randomly from top 3 (or fewer if less than 3 moves)
  const topN = Math.min(3, scored.length);
  const topMoves = scored.slice(0, topN);
  return pickRandom(topMoves).move;
}

// ─── Hard: Alpha-Beta Minimax ────────────────────────────

const SEARCH_DEPTH = 3;

function getHardMove(chess: Chess): VerboseMove {
  const isWhite = chess.turn() === "w";
  const moves = chess.moves({ verbose: true });
  let bestMove = moves[0];
  let bestScore = isWhite ? -Infinity : Infinity;

  for (const move of moves) {
    chess.move({ from: move.from, to: move.to, promotion: move.promotion });
    const score = alphaBeta(chess, SEARCH_DEPTH - 1, -Infinity, Infinity, !isWhite);
    chess.undo();

    if (isWhite) {
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    } else {
      if (score < bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }
  }

  return bestMove;
}

function alphaBeta(
  chess: Chess,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean,
): number {
  if (depth === 0 || chess.isGameOver()) {
    return evaluate(chess);
  }

  const moves = chess.moves({ verbose: true });

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      chess.move({ from: move.from, to: move.to, promotion: move.promotion });
      const score = alphaBeta(chess, depth - 1, alpha, beta, false);
      chess.undo();
      maxEval = Math.max(maxEval, score);
      alpha = Math.max(alpha, score);
      if (beta <= alpha) break;
    }
    return maxEval;
  }

  let minEval = Infinity;
  for (const move of moves) {
    chess.move({ from: move.from, to: move.to, promotion: move.promotion });
    const score = alphaBeta(chess, depth - 1, alpha, beta, true);
    chess.undo();
    minEval = Math.min(minEval, score);
    beta = Math.min(beta, score);
    if (beta <= alpha) break;
  }
  return minEval;
}

// ─── Board Evaluation ────────────────────────────────────

/**
 * Evaluate a position from white's perspective.
 * Material + piece-square tables.
 */
function evaluate(chess: Chess): number {
  if (chess.isCheckmate()) {
    // The side to move is in checkmate, so they lost
    return chess.turn() === "w" ? -100000 : 100000;
  }
  if (chess.isDraw() || chess.isStalemate()) {
    return 0;
  }

  let score = 0;
  const boardArray = chess.board();

  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const piece = boardArray[rank][file];
      if (!piece) continue;

      const pieceType = piece.type;
      const materialValue = PIECE_VALUES[pieceType] ?? 0;

      // Table index: for white, direct mapping (rank * 8 + file).
      // For black, mirror vertically: (7 - rank) * 8 + file.
      const table = PIECE_SQUARE_TABLES[pieceType];
      let positionalValue = 0;
      if (table) {
        const whiteIndex = rank * 8 + file;
        const blackIndex = (7 - rank) * 8 + file;
        positionalValue = piece.color === "w" ? table[whiteIndex] : table[blackIndex];
      }

      if (piece.color === "w") {
        score += materialValue + positionalValue;
      } else {
        score -= materialValue + positionalValue;
      }
    }
  }

  return score;
}
