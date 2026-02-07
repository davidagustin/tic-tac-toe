import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { Platform, Pressable, Text, View } from "react-native";
import { Board } from "../components/game/Board";
import { GameStatus } from "../components/game/GameStatus";
import { PlayerBadge } from "../components/game/PlayerBadge";
import { useLocalGame } from "../hooks/useLocalGame";

export default function LocalGameScreen() {
  const { board, currentTurn, status, winningCells, isGameOver, makeMove, resetGame } =
    useLocalGame();

  const handleReset = () => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    resetGame();
  };

  return (
    <View className="flex-1 bg-bg-primary px-6 pt-16">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-8">
        <Pressable onPress={() => router.back()} className="active:opacity-60">
          <Text className="text-text-secondary text-base">← Back</Text>
        </Pressable>
        <Text className="text-text-muted text-sm uppercase tracking-widest">Local Game</Text>
        <View className="w-12" />
      </View>

      {/* Player Badges */}
      <View className="flex-row justify-between mb-6">
        <PlayerBadge symbol="X" name="Player 1" isActive={currentTurn === "X" && !isGameOver} />
        <PlayerBadge symbol="O" name="Player 2" isActive={currentTurn === "O" && !isGameOver} />
      </View>

      {/* Status */}
      <GameStatus status={status} currentTurn={currentTurn} />

      {/* Board */}
      <View className="items-center">
        <Board
          board={board}
          onCellPress={makeMove}
          disabled={isGameOver}
          winningCells={winningCells}
        />
      </View>

      {/* Reset Button */}
      {isGameOver && (
        <View className="items-center mt-8">
          <Pressable
            className="bg-accent-primary px-8 py-4 rounded-2xl active:opacity-80"
            onPress={handleReset}
          >
            <Text className="text-text-primary text-lg font-semibold">Play Again</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
