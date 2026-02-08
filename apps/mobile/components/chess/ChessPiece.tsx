import { CHESS_CONFIG } from "@ttt/shared";
import { Text } from "react-native";

interface ChessPieceProps {
  piece: string; // e.g. "wp", "bk"
  size?: number;
}

export function ChessPiece({ piece, size = 32 }: ChessPieceProps) {
  const color = piece[0] === "w" ? "white" : "black";
  const type = piece[1] as keyof (typeof CHESS_CONFIG.PIECE_SYMBOLS)["white"];
  const symbol = CHESS_CONFIG.PIECE_SYMBOLS[color][type];

  return (
    <Text style={{ fontSize: size, lineHeight: size * 1.2, textAlign: "center" }}>{symbol}</Text>
  );
}
