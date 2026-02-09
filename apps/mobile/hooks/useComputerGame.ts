import type { AiDifficulty } from "@ttt/shared";
import { useEffect, useRef } from "react";
import { useComputerGameStore } from "../stores/computerGameStore";

const THINKING_DELAYS: Record<AiDifficulty, number> = {
  easy: 400,
  medium: 600,
  hard: 800,
};

export function useComputerGame() {
  const game = useComputerGameStore((state) => state.game);
  const difficulty = useComputerGameStore((state) => state.difficulty);
  const isComputerThinking = useComputerGameStore((state) => state.isComputerThinking);
  const isGameOver = useComputerGameStore((state) => state.isGameOver);
  const startGame = useComputerGameStore((state) => state.startGame);
  const makePlayerTttMove = useComputerGameStore((state) => state.makePlayerTttMove);
  const makePlayerChessMove = useComputerGameStore((state) => state.makePlayerChessMove);
  const triggerComputerMove = useComputerGameStore((state) => state.triggerComputerMove);
  const resetGame = useComputerGameStore((state) => state.resetGame);
  const newGame = useComputerGameStore((state) => state.newGame);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Determine if it's the computer's turn
  const isComputerTurn = (() => {
    if (!game) return false;
    if (game.gameType === "tic_tac_toe") {
      return game.currentTurn === game.computerMark;
    }
    if (game.gameType === "chess") {
      return game.currentTurn === game.computerColor;
    }
    return false;
  })();

  useEffect(() => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Check if we should trigger a computer move
    if (isComputerTurn && !isGameOver && !isComputerThinking && difficulty && game) {
      const delay = THINKING_DELAYS[difficulty];
      timeoutRef.current = setTimeout(() => {
        triggerComputerMove();
      }, delay);
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [isComputerTurn, isGameOver, isComputerThinking, difficulty, game, triggerComputerMove]);

  return {
    game,
    difficulty,
    isComputerThinking,
    isGameOver,
    startGame,
    makePlayerTttMove,
    makePlayerChessMove,
    resetGame,
    newGame,
  };
}
