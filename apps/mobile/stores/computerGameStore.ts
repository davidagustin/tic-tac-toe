import type { AiDifficulty, Board, ChessColor, GameStatus, GameType, Player } from "@ttt/shared";
import {
  applyMove,
  CHESS_CONFIG,
  EMPTY_BOARD,
  getChessAiMove,
  getGameStatus,
  getTttAiMove,
  getWinningCells,
} from "@ttt/shared";
import { Chess } from "chess.js";
import { create } from "zustand";

// ─── TTT Computer Game State ─────────────────
interface TttComputerGame {
  gameType: "tic_tac_toe";
  board: Board;
  currentTurn: Player;
  status: GameStatus;
  winningCells: number[] | null;
  playerMark: Player;
  computerMark: Player;
}

// ─── Chess Computer Game State ───────────────
interface ChessComputerGame {
  gameType: "chess";
  fen: string;
  pgn: string;
  currentTurn: ChessColor;
  status: GameStatus;
  isCheck: boolean;
  lastMove?: { from: string; to: string };
  capturedPieces: { white: string[]; black: string[] };
  playerColor: ChessColor;
  computerColor: ChessColor;
}

type ComputerGame = TttComputerGame | ChessComputerGame;

interface ComputerGameStoreState {
  game: ComputerGame | null;
  difficulty: AiDifficulty | null;
  isComputerThinking: boolean;
  isGameOver: boolean;

  // Actions
  startGame: (gameType: GameType, difficulty: AiDifficulty) => void;
  makePlayerTttMove: (position: number) => void;
  makePlayerChessMove: (from: string, to: string, promotion?: string) => void;
  triggerComputerMove: () => void;
  resetGame: () => void; // same settings, fresh board
  newGame: () => void; // clear everything
}

export const useComputerGameStore = create<ComputerGameStoreState>((set, get) => ({
  game: null,
  difficulty: null,
  isComputerThinking: false,
  isGameOver: false,

  startGame: (gameType: GameType, difficulty: AiDifficulty) => {
    if (gameType === "tic_tac_toe") {
      set({
        game: {
          gameType: "tic_tac_toe",
          board: EMPTY_BOARD,
          currentTurn: "X",
          status: "in_progress",
          winningCells: null,
          playerMark: "X",
          computerMark: "O",
        },
        difficulty,
        isComputerThinking: false,
        isGameOver: false,
      });
    } else if (gameType === "chess") {
      set({
        game: {
          gameType: "chess",
          fen: CHESS_CONFIG.INITIAL_FEN,
          pgn: "",
          currentTurn: "white",
          status: "in_progress",
          isCheck: false,
          lastMove: undefined,
          capturedPieces: { white: [], black: [] },
          playerColor: "white",
          computerColor: "black",
        },
        difficulty,
        isComputerThinking: false,
        isGameOver: false,
      });
    }
  },

  makePlayerTttMove: (position: number) => {
    const { game } = get();
    if (!game) return;
    if (game.gameType !== "tic_tac_toe") return;
    if (game.status !== "in_progress") return;
    if (game.currentTurn !== game.playerMark) return;

    const newBoard = applyMove(game.board, position, game.playerMark);
    if (!newBoard) return; // Invalid move

    const newStatus = getGameStatus(newBoard);
    const newWinningCells = newStatus !== "in_progress" ? getWinningCells(newBoard) : null;
    const isGameOver = newStatus !== "in_progress";

    set({
      game: {
        ...game,
        board: newBoard,
        currentTurn: isGameOver ? game.currentTurn : game.computerMark,
        status: newStatus,
        winningCells: newWinningCells,
      },
      isGameOver,
    });
  },

  makePlayerChessMove: (from: string, to: string, promotion?: string) => {
    const { game } = get();
    if (!game) return;
    if (game.gameType !== "chess") return;
    if (game.status !== "in_progress") return;
    if (game.currentTurn !== game.playerColor) return;

    const chess = new Chess(game.fen);
    const move = chess.move({ from, to, promotion });
    if (!move) return; // Invalid move

    // Track captured pieces
    const newCapturedPieces = { ...game.capturedPieces };
    if (move.captured) {
      if (move.color === "w") {
        newCapturedPieces.white = [...newCapturedPieces.white, move.captured];
      } else {
        newCapturedPieces.black = [...newCapturedPieces.black, move.captured];
      }
    }

    // Check game over conditions
    let newStatus: GameStatus = "in_progress";
    if (chess.isCheckmate()) {
      newStatus = move.color === "w" ? "white_wins" : "black_wins";
    } else if (
      chess.isDraw() ||
      chess.isStalemate() ||
      chess.isThreefoldRepetition() ||
      chess.isInsufficientMaterial()
    ) {
      newStatus = "draw";
    }

    const isGameOver = newStatus !== "in_progress";

    set({
      game: {
        ...game,
        fen: chess.fen(),
        pgn: chess.pgn(),
        currentTurn: isGameOver ? game.currentTurn : move.color === "w" ? "black" : "white",
        status: newStatus,
        isCheck: chess.isCheck(),
        lastMove: { from: move.from, to: move.to },
        capturedPieces: newCapturedPieces,
      },
      isGameOver,
    });
  },

  triggerComputerMove: () => {
    const { game, difficulty } = get();
    if (!game || !difficulty) return;
    if (game.status !== "in_progress") return;

    set({ isComputerThinking: true });

    if (game.gameType === "tic_tac_toe") {
      if (game.currentTurn !== game.computerMark) {
        set({ isComputerThinking: false });
        return;
      }

      const aiResult = getTttAiMove(game.board, game.computerMark, difficulty);
      const newBoard = applyMove(game.board, aiResult.position, game.computerMark);
      if (!newBoard) {
        set({ isComputerThinking: false });
        return;
      }

      const newStatus = getGameStatus(newBoard);
      const newWinningCells = newStatus !== "in_progress" ? getWinningCells(newBoard) : null;
      const isGameOver = newStatus !== "in_progress";

      set({
        game: {
          ...game,
          board: newBoard,
          currentTurn: isGameOver ? game.currentTurn : game.playerMark,
          status: newStatus,
          winningCells: newWinningCells,
        },
        isComputerThinking: false,
        isGameOver,
      });
    } else if (game.gameType === "chess") {
      if (game.currentTurn !== game.computerColor) {
        set({ isComputerThinking: false });
        return;
      }

      const aiResult = getChessAiMove(game.fen, difficulty);
      const chess = new Chess(game.fen);
      const move = chess.move({
        from: aiResult.from,
        to: aiResult.to,
        promotion: aiResult.promotion,
      });
      if (!move) {
        set({ isComputerThinking: false });
        return;
      }

      // Track captured pieces
      const newCapturedPieces = { ...game.capturedPieces };
      if (move.captured) {
        if (move.color === "w") {
          newCapturedPieces.white = [...newCapturedPieces.white, move.captured];
        } else {
          newCapturedPieces.black = [...newCapturedPieces.black, move.captured];
        }
      }

      // Check game over conditions
      let newStatus: GameStatus = "in_progress";
      if (chess.isCheckmate()) {
        newStatus = move.color === "w" ? "white_wins" : "black_wins";
      } else if (
        chess.isDraw() ||
        chess.isStalemate() ||
        chess.isThreefoldRepetition() ||
        chess.isInsufficientMaterial()
      ) {
        newStatus = "draw";
      }

      const isGameOver = newStatus !== "in_progress";

      set({
        game: {
          ...game,
          fen: chess.fen(),
          pgn: chess.pgn(),
          currentTurn: isGameOver ? game.currentTurn : move.color === "w" ? "black" : "white",
          status: newStatus,
          isCheck: chess.isCheck(),
          lastMove: { from: move.from, to: move.to },
          capturedPieces: newCapturedPieces,
        },
        isComputerThinking: false,
        isGameOver,
      });
    }
  },

  resetGame: () => {
    const { game, difficulty } = get();
    if (!game || !difficulty) return;

    if (game.gameType === "tic_tac_toe") {
      set({
        game: {
          gameType: "tic_tac_toe",
          board: EMPTY_BOARD,
          currentTurn: "X",
          status: "in_progress",
          winningCells: null,
          playerMark: "X",
          computerMark: "O",
        },
        isComputerThinking: false,
        isGameOver: false,
      });
    } else if (game.gameType === "chess") {
      set({
        game: {
          gameType: "chess",
          fen: CHESS_CONFIG.INITIAL_FEN,
          pgn: "",
          currentTurn: "white",
          status: "in_progress",
          isCheck: false,
          lastMove: undefined,
          capturedPieces: { white: [], black: [] },
          playerColor: "white",
          computerColor: "black",
        },
        isComputerThinking: false,
        isGameOver: false,
      });
    }
  },

  newGame: () => {
    set({
      game: null,
      difficulty: null,
      isComputerThinking: false,
      isGameOver: false,
    });
  },
}));
