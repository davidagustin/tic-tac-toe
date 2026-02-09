import type { AiDifficulty, GameType } from "@ttt/shared";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useComputerGameStore } from "../../stores/computerGameStore";

export default function ComputerSetupScreen() {
  const [gameType, setGameType] = useState<GameType>("tic_tac_toe");
  const [difficulty, setDifficulty] = useState<AiDifficulty>("medium");
  const { startGame } = useComputerGameStore();

  const difficultyDescriptions: Record<GameType, Record<AiDifficulty, string>> = {
    tic_tac_toe: {
      easy: "Random moves. Great for learning the basics.",
      medium: "Smart moves. A good challenge for most players.",
      hard: "Perfect play. Can you beat the best?",
    },
    chess: {
      easy: "Random moves. Great for learning the basics.",
      medium: "Smart moves. A good challenge for most players.",
      hard: "Thinks ahead. A tough opponent.",
    },
  };

  const handleStartGame = () => {
    startGame(gameType, difficulty);
    router.push("/(computer)/play");
  };

  return (
    <View className="flex-1 bg-bg-primary px-6 pt-16">
      {/* Header */}
      <View className="mb-8">
        <Pressable
          className="absolute top-0 left-0 py-2 pr-4 active:opacity-60"
          onPress={() => router.back()}
        >
          <Text className="text-text-secondary text-lg">← Back</Text>
        </Pressable>
        <Text className="text-2xl font-bold text-text-primary text-center mt-8">
          Play vs Computer
        </Text>
        <Text className="text-text-secondary text-center mt-2">
          Choose your game and difficulty
        </Text>
      </View>

      {/* Game Type Selection */}
      <View className="mb-8">
        <Text className="text-text-primary font-semibold mb-3">Game Type</Text>
        <View className="flex-row gap-4">
          {/* Tic-Tac-Toe Card */}
          <Pressable
            className={`flex-1 bg-bg-card border-2 rounded-2xl p-6 items-center active:opacity-80 ${
              gameType === "tic_tac_toe" ? "border-blue-500" : "border-neutral-800"
            }`}
            onPress={() => setGameType("tic_tac_toe")}
          >
            <Text className="text-4xl mb-2">X|O</Text>
            <Text
              className={`font-semibold ${
                gameType === "tic_tac_toe" ? "text-blue-500" : "text-text-secondary"
              }`}
            >
              Tic-Tac-Toe
            </Text>
          </Pressable>

          {/* Chess Card */}
          <Pressable
            className={`flex-1 bg-bg-card border-2 rounded-2xl p-6 items-center active:opacity-80 ${
              gameType === "chess" ? "border-amber-500" : "border-neutral-800"
            }`}
            onPress={() => setGameType("chess")}
          >
            <Text className="text-4xl mb-2">♚</Text>
            <Text
              className={`font-semibold ${
                gameType === "chess" ? "text-amber-500" : "text-text-secondary"
              }`}
            >
              Chess
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Difficulty Selection */}
      <View className="mb-6">
        <Text className="text-text-primary font-semibold mb-3">Difficulty</Text>
        <View className="flex-row gap-3">
          {/* Easy */}
          <Pressable
            className={`flex-1 border-2 rounded-xl py-3 items-center active:opacity-80 ${
              difficulty === "easy"
                ? "bg-green-500/20 border-green-500"
                : "bg-bg-card border-neutral-800"
            }`}
            onPress={() => setDifficulty("easy")}
          >
            <Text
              className={
                difficulty === "easy" ? "text-green-500 font-semibold" : "text-text-secondary"
              }
            >
              Easy
            </Text>
          </Pressable>

          {/* Medium */}
          <Pressable
            className={`flex-1 border-2 rounded-xl py-3 items-center active:opacity-80 ${
              difficulty === "medium"
                ? "bg-yellow-500/20 border-yellow-500"
                : "bg-bg-card border-neutral-800"
            }`}
            onPress={() => setDifficulty("medium")}
          >
            <Text
              className={
                difficulty === "medium" ? "text-yellow-500 font-semibold" : "text-text-secondary"
              }
            >
              Medium
            </Text>
          </Pressable>

          {/* Hard */}
          <Pressable
            className={`flex-1 border-2 rounded-xl py-3 items-center active:opacity-80 ${
              difficulty === "hard"
                ? "bg-red-500/20 border-red-500"
                : "bg-bg-card border-neutral-800"
            }`}
            onPress={() => setDifficulty("hard")}
          >
            <Text
              className={
                difficulty === "hard" ? "text-red-500 font-semibold" : "text-text-secondary"
              }
            >
              Hard
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Difficulty Description */}
      <View className="bg-bg-card border border-neutral-800 rounded-xl p-4 mb-8">
        <Text className="text-text-secondary text-sm leading-5">
          {difficultyDescriptions[gameType][difficulty]}
        </Text>
      </View>

      {/* Spacer */}
      <View className="flex-1" />

      {/* Start Game Button */}
      <Pressable
        className="bg-accent-primary py-4 rounded-2xl items-center active:opacity-80 mb-8"
        onPress={handleStartGame}
      >
        <Text className="text-text-primary text-lg font-semibold">Start Game</Text>
      </Pressable>
    </View>
  );
}
