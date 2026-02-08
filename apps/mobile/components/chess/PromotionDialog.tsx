import type { ChessColor } from "@ttt/shared";
import { Modal, Pressable, Text, View } from "react-native";
import { ChessPiece } from "./ChessPiece";

interface PromotionDialogProps {
  visible: boolean;
  color: ChessColor;
  onSelect: (piece: string) => void;
}

const PROMOTION_PIECES = ["q", "r", "b", "n"] as const;
const PIECE_NAMES: Record<string, string> = {
  q: "Queen",
  r: "Rook",
  b: "Bishop",
  n: "Knight",
};

export function PromotionDialog({ visible, color, onSelect }: PromotionDialogProps) {
  const colorPrefix = color === "white" ? "w" : "b";

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 bg-black/60 justify-center items-center px-6">
        <View className="bg-bg-card w-full max-w-xs rounded-2xl p-6 border border-neutral-800">
          <Text className="text-text-primary text-xl font-bold text-center mb-4">Promote Pawn</Text>
          <View className="flex-row justify-around">
            {PROMOTION_PIECES.map((piece) => (
              <Pressable
                key={piece}
                className="items-center p-3 rounded-xl bg-bg-secondary active:opacity-80"
                onPress={() => onSelect(piece)}
              >
                <ChessPiece piece={`${colorPrefix}${piece}`} size={40} />
                <Text className="text-text-muted text-xs mt-1">{PIECE_NAMES[piece]}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}
