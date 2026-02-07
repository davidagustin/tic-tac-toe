import type { Player, RoomMember } from "@ttt/shared";
import { Pressable, Text, View } from "react-native";

interface PlayerSlotProps {
  member: RoomMember | null;
  mark: Player;
  isHost: boolean;
  canKick: boolean;
  onKick?: () => void;
}

export function PlayerSlot({ member, mark, isHost, canKick, onKick }: PlayerSlotProps) {
  const markColor = mark === "X" ? "text-accent-x" : "text-accent-o";
  const markBg = mark === "X" ? "bg-accent-x/20" : "bg-accent-o/20";

  if (!member) {
    return (
      <View className="bg-bg-card rounded-2xl p-4 border border-neutral-800 border-dashed items-center justify-center h-24">
        <Text className="text-text-muted text-sm">Waiting for player...</Text>
      </View>
    );
  }

  return (
    <View className="bg-bg-card rounded-2xl p-4 border border-neutral-800">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <View className={`w-10 h-10 rounded-full items-center justify-center ${markBg}`}>
            <Text className={`text-xl font-bold ${markColor}`}>{mark}</Text>
          </View>
          <View>
            <View className="flex-row items-center gap-2">
              <Text className="text-text-primary font-semibold">{member.name}</Text>
              {isHost && (
                <View className="bg-yellow-500/20 px-1.5 py-0.5 rounded">
                  <Text className="text-yellow-500 text-[10px] font-bold">HOST</Text>
                </View>
              )}
            </View>
            <Text className="text-text-muted text-xs">Rating: {member.rating}</Text>
          </View>
        </View>
        <View className="flex-row items-center gap-2">
          {member.isReady && (
            <View className="bg-green-500/20 px-2 py-1 rounded-full">
              <Text className="text-green-500 text-xs font-medium">Ready</Text>
            </View>
          )}
          {canKick && (
            <Pressable
              className="bg-accent-o/20 px-2 py-1 rounded-full active:opacity-80"
              onPress={onKick}
            >
              <Text className="text-accent-o text-xs font-medium">Kick</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}
