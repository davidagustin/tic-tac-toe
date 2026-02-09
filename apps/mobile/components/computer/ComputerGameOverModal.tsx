import type { GameStatus, GameType } from "@ttt/shared";
import { Pressable, Text, View } from "react-native";

interface ComputerGameOverModalProps {
  visible: boolean;
  status: GameStatus;
  gameType: GameType;
  onPlayAgain: () => void;
  onNewGame: () => void;
}

const RESULT_MAP: Record<GameType, Record<string, { text: string; color: string }>> = {
  tic_tac_toe: {
    x_wins: { text: "You Win!", color: "text-green-500" },
    o_wins: { text: "You Lose!", color: "text-red-500" },
    draw: { text: "Draw!", color: "text-yellow-500" },
  },
  chess: {
    white_wins: { text: "You Win!", color: "text-green-500" },
    black_wins: { text: "You Lose!", color: "text-red-500" },
    draw: { text: "Draw!", color: "text-yellow-500" },
  },
};

export function ComputerGameOverModal({
  visible,
  status,
  gameType,
  onPlayAgain,
  onNewGame,
}: ComputerGameOverModalProps) {
  if (!visible) return null;

  const result = RESULT_MAP[gameType]?.[status] ?? {
    text: "Game Over",
    color: "text-text-primary",
  };

  return (
    <View className="absolute inset-0 bg-black/80 items-center justify-center px-8">
      <View className="bg-bg-card border border-neutral-800 rounded-3xl p-8 w-full max-w-sm">
        {/* Result Text */}
        <Text className={`text-4xl font-bold text-center mb-8 ${result.color}`}>{result.text}</Text>

        {/* Buttons */}
        <View className="gap-3">
          <Pressable
            className="bg-accent-primary py-3 rounded-xl items-center active:opacity-80"
            onPress={onPlayAgain}
          >
            <Text className="text-text-primary text-lg font-semibold">Play Again</Text>
          </Pressable>

          <Pressable
            className="bg-bg-card border border-neutral-800 py-3 rounded-xl items-center active:opacity-80"
            onPress={onNewGame}
          >
            <Text className="text-text-primary text-lg font-semibold">New Game</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
