import { Pressable, View } from "react-native";
import { ChessPiece } from "./ChessPiece";

interface ChessSquareProps {
  row: number; // 0-7 from top
  col: number; // 0-7 from left
  piece: string | null; // e.g. "wp", "bk", null
  isSelected: boolean;
  isValidMove: boolean;
  isLastMoveFrom: boolean;
  isLastMoveTo: boolean;
  isCheck: boolean;
  squareSize: number;
  onPress: () => void;
}

export function ChessSquare({
  row,
  col,
  piece,
  isSelected,
  isValidMove,
  isLastMoveFrom,
  isLastMoveTo,
  isCheck,
  squareSize,
  onPress,
}: ChessSquareProps) {
  const isLight = (row + col) % 2 === 0;

  // Base color
  let bgColor = isLight ? "#e8dcc8" : "#b58863";

  // Highlight layers
  if (isSelected) {
    bgColor = "#3b82f6"; // blue for selection
  } else if (isLastMoveFrom || isLastMoveTo) {
    bgColor = isLight ? "#f0d874" : "#d4a829"; // yellow for last move
  } else if (isCheck) {
    bgColor = "#ef4444"; // red for check
  }

  return (
    <Pressable onPress={onPress} style={{ width: squareSize, height: squareSize }}>
      <View
        style={{
          width: squareSize,
          height: squareSize,
          backgroundColor: bgColor,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {piece && <ChessPiece piece={piece} size={squareSize * 0.7} />}
        {isValidMove && !piece && (
          <View
            style={{
              width: squareSize * 0.3,
              height: squareSize * 0.3,
              borderRadius: squareSize * 0.15,
              backgroundColor: "rgba(34, 197, 94, 0.5)",
            }}
          />
        )}
        {isValidMove && piece && (
          <View
            style={{
              position: "absolute",
              width: squareSize,
              height: squareSize,
              borderRadius: squareSize * 0.5,
              borderWidth: 3,
              borderColor: "rgba(34, 197, 94, 0.6)",
            }}
          />
        )}
      </View>
    </Pressable>
  );
}
