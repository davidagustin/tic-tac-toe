import type { Board as BoardType, CellValue } from "@ttt/shared";
import { View } from "react-native";
import { Cell } from "./Cell";

interface BoardProps {
  board: BoardType;
  onCellPress: (index: number) => void;
  disabled: boolean;
  winningCells: number[] | null;
}

export function Board({ board, onCellPress, disabled, winningCells }: BoardProps) {
  return (
    <View className="w-full max-w-sm aspect-square bg-bg-card rounded-3xl overflow-hidden border border-neutral-800">
      <View className="flex-row flex-wrap">
        {board.map((cell: CellValue, index: number) => (
          <View key={index} className="w-1/3">
            <Cell
              value={cell}
              index={index}
              onPress={onCellPress}
              disabled={disabled}
              isWinningCell={winningCells?.includes(index) ?? false}
            />
          </View>
        ))}
      </View>
    </View>
  );
}
