import type { RoomInfo } from "@ttt/shared";
import { Pressable, Text, View } from "react-native";

interface RoomCardProps {
  room: RoomInfo;
  onJoin: (roomId: string) => void;
}

export function RoomCard({ room, onJoin }: RoomCardProps) {
  const isPlaying = room.status === "playing";
  const isFull = room.playerCount >= room.maxPlayers;
  const isChess = room.gameType === "chess";

  return (
    <Pressable
      className="bg-bg-card rounded-2xl p-4 border border-neutral-800 active:opacity-80"
      onPress={() => onJoin(room.id)}
    >
      <View className="flex-row justify-between items-start mb-2">
        <View className="flex-1 mr-3">
          <View className="flex-row items-center gap-2">
            {room.hasPassword && <Text className="text-yellow-500 text-xs">🔒</Text>}
            <Text className="text-text-primary font-semibold text-base" numberOfLines={1}>
              {room.name}
            </Text>
            <View
              className={`px-1.5 py-0.5 rounded ${isChess ? "bg-amber-500/20" : "bg-blue-500/20"}`}
            >
              <Text
                className={`text-[9px] font-bold ${isChess ? "text-amber-500" : "text-blue-500"}`}
              >
                {isChess ? "CHESS" : "TTT"}
              </Text>
            </View>
          </View>
          <Text className="text-text-secondary text-xs mt-1">Host: {room.hostName}</Text>
        </View>
        <View
          className={`px-2 py-1 rounded-full ${isPlaying ? "bg-accent-o/20" : isFull ? "bg-yellow-500/20" : "bg-green-500/20"}`}
        >
          <Text
            className={`text-xs font-medium ${isPlaying ? "text-accent-o" : isFull ? "text-yellow-500" : "text-green-500"}`}
          >
            {isPlaying ? "Playing" : isFull ? "Full" : "Open"}
          </Text>
        </View>
      </View>
      <View className="flex-row justify-between items-center">
        <Text className="text-text-muted text-xs">
          Players: {room.playerCount}/{room.maxPlayers}
          {room.spectatorCount > 0 && ` · Spectators: ${room.spectatorCount}`}
        </Text>
      </View>
    </Pressable>
  );
}
