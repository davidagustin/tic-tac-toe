import { Text, View } from "react-native";

interface CapturedPiecesProps {
  pieces: string[]; // Unicode symbols
  label: string;
}

export function CapturedPieces({ pieces, label }: CapturedPiecesProps) {
  if (pieces.length === 0) return null;

  return (
    <View className="flex-row items-center gap-1 px-2">
      <Text className="text-text-muted text-xs">{label}:</Text>
      <Text className="text-base">{pieces.join("")}</Text>
    </View>
  );
}
