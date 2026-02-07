import { useState, useCallback } from 'react';
import {
  Board,
  Player,
  GameStatus,
  EMPTY_BOARD,
  applyMove,
  isValidMove,
  getGameStatus,
  getNextTurn,
  getWinningCells,
} from '@ttt/shared';

interface LocalGameState {
  board: Board;
  currentTurn: Player;
  status: GameStatus;
  winningCells: number[] | null;
  moveCount: number;
}

export function useLocalGame() {
  const [gameState, setGameState] = useState<LocalGameState>({
    board: EMPTY_BOARD,
    currentTurn: 'X',
    status: 'in_progress',
    winningCells: null,
    moveCount: 0,
  });

  const makeMove = useCallback((position: number) => {
    setGameState((prev) => {
      // Validate
      if (prev.status !== 'in_progress') return prev;
      if (!isValidMove(prev.board, position)) return prev;

      // Apply
      const newBoard = applyMove(prev.board, position, prev.currentTurn);
      const status = getGameStatus(newBoard);
      const winningCells = getWinningCells(newBoard);

      return {
        board: newBoard,
        currentTurn: getNextTurn(prev.currentTurn),
        status,
        winningCells,
        moveCount: prev.moveCount + 1,
      };
    });
  }, []);

  const resetGame = useCallback(() => {
    setGameState({
      board: EMPTY_BOARD,
      currentTurn: 'X',
      status: 'in_progress',
      winningCells: null,
      moveCount: 0,
    });
  }, []);

  const isGameOver = gameState.status !== 'in_progress';

  return {
    ...gameState,
    makeMove,
    resetGame,
    isGameOver,
  };
}
