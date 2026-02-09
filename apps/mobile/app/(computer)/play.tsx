import type { AiDifficulty, GameType } from "@ttt/shared";
import { router } from "expo-router";
import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import { ChessBoard } from "../../components/chess/ChessBoard";
import { ComputerGameOverModal } from "../../components/computer/ComputerGameOverModal";
import { ThinkingIndicator } from "../../components/computer/ThinkingIndicator";
import { Board } from "../../components/game/Board";
import { useComputerGame } from "../../hooks/useComputerGame";

// ─── Lookup tables to avoid nested conditionals ─────────

const DIFFICULTY_COLORS: Record<AiDifficulty, string> = {
  easy: "text-green-500 border-green-500 bg-green-500/20",
  medium: "text-yellow-500 border-yellow-500 bg-yellow-500/20",
  hard: "text-red-500 border-red-500 bg-red-500/20",
};

const GAME_TYPE_COLORS: Record<GameType, string> = {
  tic_tac_toe: "text-blue-500 border-blue-500 bg-blue-500/20",
  chess: "text-amber-500 border-amber-500 bg-amber-500/20",
};

const GAME_TYPE_NAMES: Record<GameType, string> = {
  tic_tac_toe: "TTT",
  chess: "Chess",
};

// ─── Extracted sub-components ────────────────────────────

function GameHeader({
  difficulty,
  gameType,
  onQuit,
}: {
  difficulty: AiDifficulty;
  gameType: GameType;
  onQuit: () => void;
}) {
  const diffColor = DIFFICULTY_COLORS[difficulty];
  const typeColor = GAME_TYPE_COLORS[gameType];

  return (
    <View className="pt-16 px-6 pb-4 flex-row items-center justify-between">
      <View className="flex-row gap-2">
        <View className={`px-3 py-1 rounded-full border ${diffColor}`}>
          <Text className={`text-xs font-semibold ${diffColor}`}>{difficulty.toUpperCase()}</Text>
        </View>
        <View className={`px-3 py-1 rounded-full border ${typeColor}`}>
          <Text className={`text-xs font-semibold ${typeColor}`}>{GAME_TYPE_NAMES[gameType]}</Text>
        </View>
      </View>
      <Pressable className="active:opacity-60" onPress={onQuit}>
        <Text className="text-text-secondary font-semibold">Quit</Text>
      </Pressable>
    </View>
  );
}

function PlayerLabels({
  playerLabel,
  computerLabel,
  isPlayerTurn,
  isGameOver,
}: {
  playerLabel: string;
  computerLabel: string;
  isPlayerTurn: boolean;
  isGameOver: boolean;
}) {
  const activeStyle = "text-green-500";
  const inactiveStyle = "text-text-secondary";

  return (
    <View className="px-6 py-4 flex-row justify-between items-center">
      <Text
        className={`text-lg font-bold ${isPlayerTurn && !isGameOver ? activeStyle : inactiveStyle}`}
      >
        {playerLabel}
      </Text>
      <Text
        className={`text-lg font-bold ${!isPlayerTurn && !isGameOver ? activeStyle : inactiveStyle}`}
      >
        {computerLabel}
      </Text>
    </View>
  );
}

function TurnIndicator({
  isGameOver,
  isPlayerTurn,
  isComputerThinking,
}: {
  isGameOver: boolean;
  isPlayerTurn: boolean;
  isComputerThinking: boolean;
}) {
  if (isGameOver) {
    return <Text className="text-text-muted text-center">Game Over</Text>;
  }
  if (isPlayerTurn) {
    return <Text className="text-green-500 text-center font-semibold">Your turn!</Text>;
  }
  return (
    <View>
      <Text className="text-text-muted text-center">Computer's turn...</Text>
      {isComputerThinking && <ThinkingIndicator />}
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────

export default function ComputerPlayScreen() {
  const {
    game,
    difficulty,
    isComputerThinking,
    isGameOver,
    makePlayerTttMove,
    makePlayerChessMove,
    resetGame,
    newGame,
  } = useComputerGame();

  useEffect(() => {
    if (!game) {
      router.replace("/(computer)/setup");
    }
  }, [game]);

  if (!game || !difficulty) {
    return null;
  }

  const handleQuit = () => {
    newGame();
    router.replace("/(computer)/setup");
  };

  const isTtt = game.gameType === "tic_tac_toe";
  const isPlayerTurn = isTtt
    ? game.currentTurn === game.playerMark
    : game.currentTurn === game.playerColor;

  const playerLabel = isTtt
    ? `You (${game.playerMark})`
    : `You (${game.playerColor === "white" ? "White" : "Black"})`;
  const computerLabel = isTtt
    ? `Computer (${game.computerMark})`
    : `Computer (${game.computerColor === "white" ? "White" : "Black"})`;

  return (
    <View className="flex-1 bg-bg-primary">
      <GameHeader difficulty={difficulty} gameType={game.gameType} onQuit={handleQuit} />
      <PlayerLabels
        playerLabel={playerLabel}
        computerLabel={computerLabel}
        isPlayerTurn={isPlayerTurn}
        isGameOver={isGameOver}
      />
      <View className="px-6 py-2">
        <TurnIndicator
          isGameOver={isGameOver}
          isPlayerTurn={isPlayerTurn}
          isComputerThinking={isComputerThinking}
        />
      </View>

      <View className="flex-1 items-center justify-center px-6">
        {isTtt ? (
          <Board
            board={game.board}
            onCellPress={makePlayerTttMove}
            disabled={!isPlayerTurn || isGameOver}
            winningCells={game.winningCells}
          />
        ) : (
          <ChessBoard
            fen={game.fen}
            myColor={game.playerColor}
            isMyTurn={isPlayerTurn}
            disabled={isGameOver}
            lastMove={game.lastMove}
            isCheck={game.isCheck}
            capturedPieces={game.capturedPieces}
            onMove={makePlayerChessMove}
          />
        )}
      </View>

      <ComputerGameOverModal
        visible={isGameOver}
        status={game.status}
        gameType={game.gameType}
        onPlayAgain={resetGame}
        onNewGame={() => {
          newGame();
          router.replace("/(computer)/setup");
        }}
      />
    </View>
  );
}
