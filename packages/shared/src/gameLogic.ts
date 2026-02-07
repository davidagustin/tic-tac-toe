import type { Board, GameStatus, Player } from "./types";

// ─── Constants ─────────────────────────────────────────

export const BOARD_SIZE = 9;
export const EMPTY_BOARD: Board = Object.freeze(Array(BOARD_SIZE).fill(null)) as Board;

export const WIN_COMBINATIONS = [
  [0, 1, 2], // top row
  [3, 4, 5], // middle row
  [6, 7, 8], // bottom row
  [0, 3, 6], // left column
  [1, 4, 7], // middle column
  [2, 5, 8], // right column
  [0, 4, 8], // diagonal top-left to bottom-right
  [2, 4, 6], // diagonal top-right to bottom-left
] as const;

// ─── Game Logic ────────────────────────────────────────

/**
 * Check if a move is valid
 */
export function isValidMove(board: Board, position: number): boolean {
  if (position < 0 || position >= BOARD_SIZE) return false;
  return board[position] === null;
}

/**
 * Apply a move and return a new board (immutable)
 */
export function applyMove(board: Board, position: number, player: Player): Board {
  if (!isValidMove(board, position)) {
    throw new Error(`Invalid move: position ${position}`);
  }
  const newBoard = [...board];
  newBoard[position] = player;
  return newBoard;
}

/**
 * Check for a winner. Returns the winning player or null.
 */
export function checkWinner(board: Board): Player | null {
  for (const [a, b, c] of WIN_COMBINATIONS) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a] as Player;
    }
  }
  return null;
}

/**
 * Get the winning combination indices (for highlighting)
 */
export function getWinningCells(board: Board): number[] | null {
  for (const combo of WIN_COMBINATIONS) {
    const [a, b, c] = combo;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return [a, b, c];
    }
  }
  return null;
}

/**
 * Check if the board is full (draw condition)
 */
export function isBoardFull(board: Board): boolean {
  return board.every((cell) => cell !== null);
}

/**
 * Determine the game status from the current board
 */
export function getGameStatus(board: Board): GameStatus {
  const winner = checkWinner(board);
  if (winner === "X") return "x_wins";
  if (winner === "O") return "o_wins";
  if (isBoardFull(board)) return "draw";
  return "in_progress";
}

/**
 * Get the next player's turn
 */
export function getNextTurn(currentTurn: Player): Player {
  return currentTurn === "X" ? "O" : "X";
}

/**
 * Count moves made on the board
 */
export function getMoveCount(board: Board): number {
  return board.filter((cell) => cell !== null).length;
}

/**
 * Get all available (empty) positions
 */
export function getAvailableMoves(board: Board): number[] {
  return board.reduce<number[]>((moves, cell, index) => {
    if (cell === null) moves.push(index);
    return moves;
  }, []);
}

/**
 * Determine whose turn it is based on the board state
 * (X always goes first)
 */
export function getCurrentTurn(board: Board): Player {
  const moveCount = getMoveCount(board);
  return moveCount % 2 === 0 ? "X" : "O";
}
