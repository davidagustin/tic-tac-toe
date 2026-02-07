import type { GameStatus as GameStatusType, Player } from "@ttt/shared";
import { Text, View } from "react-native";

interface GameStatusProps {
  status: GameStatusType;
  currentTurn: Player;
}

export function GameStatus({ status, currentTurn }: GameStatusProps) {
  const getMessage = () => {
    switch (status) {
      case "x_wins":
        return { text: "X Wins!", color: "text-accent-x" };
      case "o_wins":
        return { text: "O Wins!", color: "text-accent-o" };
      case "draw":
        return { text: "It's a Draw!", color: "text-text-secondary" };
      default:
        return {
          text: `${currentTurn}'s Turn`,
          color: currentTurn === "X" ? "text-accent-x" : "text-accent-o",
        };
    }
  };

  const { text, color } = getMessage();

  return (
    <View className="items-center py-6">
      <Text className={`text-3xl font-bold ${color}`}>{text}</Text>
    </View>
  );
}
