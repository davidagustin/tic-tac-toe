import { applyMove, checkWinner, getAvailableMoves, getNextTurn, isBoardFull } from "../gameLogic";
import type { Board, Player } from "../types";
import type { AiDifficulty, AiMoveResult } from "./types";

// ─── Public API ──────────────────────────────────────────

/**
 * Returns the AI's chosen move for tic-tac-toe given the board,
 * the AI's mark, and the difficulty level.
 */
export function getTttAiMove(
  board: Board,
  aiPlayer: Player,
  difficulty: AiDifficulty,
): AiMoveResult {
  const available = getAvailableMoves(board);
  if (available.length === 0) {
    throw new Error("No available moves on the board");
  }

  switch (difficulty) {
    case "easy":
      return { position: pickRandom(available) };
    case "medium":
      return { position: getMediumMove(board, aiPlayer, available) };
    case "hard":
      return { position: getHardMove(board, aiPlayer) };
  }
}

// ─── Easy: Random ────────────────────────────────────────

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Medium: Win / Block / Random ────────────────────────

function getMediumMove(board: Board, aiPlayer: Player, available: number[]): number {
  const opponent = getNextTurn(aiPlayer);

  // 1. Can AI win in one move?
  for (const pos of available) {
    const next = applyMove(board, pos, aiPlayer);
    if (checkWinner(next) === aiPlayer) {
      return pos;
    }
  }

  // 2. Must AI block opponent's winning move?
  for (const pos of available) {
    const next = applyMove(board, pos, opponent);
    if (checkWinner(next) === opponent) {
      return pos;
    }
  }

  // 3. Otherwise random
  return pickRandom(available);
}

// ─── Hard: Minimax (perfect play) ────────────────────────

function getHardMove(board: Board, aiPlayer: Player): number {
  const available = getAvailableMoves(board);
  let bestScore = -Infinity;
  let bestMoves: number[] = [];

  for (const pos of available) {
    const next = applyMove(board, pos, aiPlayer);
    const score = minimax(next, getNextTurn(aiPlayer), aiPlayer, false);
    if (score > bestScore) {
      bestScore = score;
      bestMoves = [pos];
    } else if (score === bestScore) {
      bestMoves.push(pos);
    }
  }

  // Prefer center (4) when multiple moves score equally
  if (bestMoves.includes(4)) return 4;
  return bestMoves[0];
}

/**
 * Minimax scoring from the perspective of `aiPlayer`.
 * +10 if AI wins, -10 if opponent wins, 0 for draw.
 * Depth adjustment ensures the AI prefers faster wins and slower losses.
 */
function minimax(
  board: Board,
  currentPlayer: Player,
  aiPlayer: Player,
  isMaximizing: boolean,
): number {
  const winner = checkWinner(board);
  if (winner === aiPlayer) return 10;
  if (winner !== null) return -10;
  if (isBoardFull(board)) return 0;

  const available = getAvailableMoves(board);

  if (isMaximizing) {
    let best = -Infinity;
    for (const pos of available) {
      const next = applyMove(board, pos, currentPlayer);
      const score = minimax(next, getNextTurn(currentPlayer), aiPlayer, false);
      best = Math.max(best, score);
    }
    return best;
  }

  let best = Infinity;
  for (const pos of available) {
    const next = applyMove(board, pos, currentPlayer);
    const score = minimax(next, getNextTurn(currentPlayer), aiPlayer, true);
    best = Math.min(best, score);
  }
  return best;
}
