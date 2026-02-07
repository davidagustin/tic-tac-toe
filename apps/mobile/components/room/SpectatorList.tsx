import type { RoomMember } from "@ttt/shared";
import { ScrollView, Text, View } from "react-native";

interface SpectatorListProps {
  spectators: RoomMember[];
}

export function SpectatorList({ spectators }: SpectatorListProps) {
  if (spectators.length === 0) return null;

  return (
    <View className="mt-3">
      <Text className="text-text-muted text-xs mb-2">Spectators ({spectators.length})</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="gap-2">
        <View className="flex-row gap-2">
          {spectators.map((s) => (
            <View
              key={s.userId}
              className="bg-bg-secondary px-3 py-1.5 rounded-full border border-neutral-800"
            >
              <Text className="text-text-secondary text-xs">{s.name}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
