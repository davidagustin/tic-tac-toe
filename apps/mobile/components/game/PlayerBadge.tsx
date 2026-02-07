import type { Player } from "@ttt/shared";
import { Text, View } from "react-native";

interface PlayerBadgeProps {
  symbol: Player;
  name: string;
  isActive: boolean;
}

export function PlayerBadge({ symbol, name, isActive }: PlayerBadgeProps) {
  const accentColor = symbol === "X" ? "border-accent-x" : "border-accent-o";
  const textColor = symbol === "X" ? "text-accent-x" : "text-accent-o";

  return (
    <View
      className={`flex-row items-center gap-3 px-4 py-3 rounded-xl
        ${isActive ? `bg-bg-card border ${accentColor}` : "opacity-50"}`}
    >
      <Text className={`text-2xl font-bold ${textColor}`}>{symbol}</Text>
      <Text className="text-text-primary text-base">{name}</Text>
    </View>
  );
}
