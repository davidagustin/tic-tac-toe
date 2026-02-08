import type { ChessColor } from "@ttt/shared";
import { Chess } from "chess.js";
import { useCallback, useMemo, useState } from "react";
import { Dimensions, Text, View } from "react-native";
import { CapturedPieces } from "./CapturedPieces";
import { ChessSquare } from "./ChessSquare";
import { PromotionDialog } from "./PromotionDialog";

interface ChessBoardProps {
  fen: string;
  myColor: ChessColor | null;
  isMyTurn: boolean;
  disabled: boolean;
  lastMove?: { from: string; to: string };
  isCheck: boolean;
  capturedPieces: { white: string[]; black: string[] };
  onMove: (from: string, to: string, promotion?: string) => void;
}

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];

function squareToCoords(square: string): { row: number; col: number } {
  const col = FILES.indexOf(square[0]);
  const rank = square[1];
  const row = RANKS.indexOf(rank);
  return { row, col };
}

function coordsToSquare(row: number, col: number): string {
  return `${FILES[col]}${RANKS[row]}`;
}

export function ChessBoard({
  fen,
  myColor,
  isMyTurn,
  disabled,
  lastMove,
  isCheck,
  capturedPieces,
  onMove,
}: ChessBoardProps) {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: string;
    to: string;
  } | null>(null);

  const chess = useMemo(() => new Chess(fen), [fen]);
  const flipped = myColor === "black";

  // Compute valid moves for selected square
  const validMoves = useMemo(() => {
    if (!selectedSquare) return new Set<string>();
    const moves = chess.moves({ square: selectedSquare as any, verbose: true });
    return new Set(moves.map((m) => m.to));
  }, [chess, selectedSquare]);

  // Find king square if in check
  const checkSquare = useMemo(() => {
    if (!isCheck) return null;
    const turn = chess.turn();
    for (const row of chess.board()) {
      for (const sq of row) {
        if (sq && sq.type === "k" && sq.color === turn) {
          return sq.square;
        }
      }
    }
    return null;
  }, [chess, isCheck]);

  const handleSquarePress = useCallback(
    (square: string) => {
      if (disabled || !isMyTurn) return;

      const piece = chess.get(square as any);

      if (selectedSquare) {
        // If clicking a valid move destination
        if (validMoves.has(square)) {
          // Check for pawn promotion
          const selectedPiece = chess.get(selectedSquare as any);
          const targetRank = square[1];
          const isPromotion =
            selectedPiece?.type === "p" && (targetRank === "8" || targetRank === "1");

          if (isPromotion) {
            setPendingPromotion({ from: selectedSquare, to: square });
          } else {
            onMove(selectedSquare, square);
          }
          setSelectedSquare(null);
          return;
        }

        // If clicking own piece, re-select
        if (piece && piece.color === (myColor === "white" ? "w" : "b")) {
          setSelectedSquare(square);
          return;
        }

        // Clicking elsewhere deselects
        setSelectedSquare(null);
        return;
      }

      // Select a piece (only own pieces)
      if (piece && piece.color === (myColor === "white" ? "w" : "b")) {
        setSelectedSquare(square);
      }
    },
    [chess, selectedSquare, validMoves, disabled, isMyTurn, myColor, onMove],
  );

  const handlePromotion = useCallback(
    (piece: string) => {
      if (pendingPromotion) {
        onMove(pendingPromotion.from, pendingPromotion.to, piece);
        setPendingPromotion(null);
      }
    },
    [pendingPromotion, onMove],
  );

  const screenWidth = Dimensions.get("window").width;
  const boardSize = Math.min(screenWidth - 32, 400);
  const squareSize = boardSize / 8;

  // Build board array from FEN
  const boardRows = flipped ? [...chess.board()].reverse() : chess.board();

  return (
    <View className="items-center">
      {/* Opponent's captured pieces */}
      <CapturedPieces
        pieces={flipped ? capturedPieces.white : capturedPieces.black}
        label={flipped ? "White captured" : "Black captured"}
      />

      {/* Board */}
      <View
        style={{
          width: boardSize,
          height: boardSize,
          borderRadius: 8,
          overflow: "hidden",
          borderWidth: 2,
          borderColor: "#404040",
        }}
      >
        {boardRows.map((row, rowIdx) => {
          const actualRow = flipped ? 7 - rowIdx : rowIdx;
          const cols = flipped ? [...row].reverse() : row;

          return (
            <View key={actualRow} style={{ flexDirection: "row" }}>
              {cols.map((square, colIdx) => {
                const actualCol = flipped ? 7 - colIdx : colIdx;
                const squareName = coordsToSquare(actualRow, actualCol);
                const piece = square ? `${square.color}${square.type}` : null;

                const lastFromCoords = lastMove ? squareToCoords(lastMove.from) : null;
                const lastToCoords = lastMove ? squareToCoords(lastMove.to) : null;

                return (
                  <ChessSquare
                    key={squareName}
                    row={actualRow}
                    col={actualCol}
                    piece={piece}
                    isSelected={selectedSquare === squareName}
                    isValidMove={validMoves.has(squareName)}
                    isLastMoveFrom={
                      lastFromCoords?.row === actualRow && lastFromCoords?.col === actualCol
                    }
                    isLastMoveTo={
                      lastToCoords?.row === actualRow && lastToCoords?.col === actualCol
                    }
                    isCheck={checkSquare === squareName}
                    squareSize={squareSize}
                    onPress={() => handleSquarePress(squareName)}
                  />
                );
              })}

              {/* Rank label */}
              <View style={{ position: "absolute", left: 2, top: 1 }}>
                <Text style={{ fontSize: 9, color: "#888" }}>
                  {RANKS[flipped ? 7 - rowIdx : rowIdx]}
                </Text>
              </View>
            </View>
          );
        })}

        {/* File labels */}
        <View style={{ position: "absolute", bottom: 1, left: 0, flexDirection: "row" }}>
          {(flipped ? [...FILES].reverse() : FILES).map((file) => (
            <View key={file} style={{ width: squareSize, alignItems: "flex-end", paddingRight: 2 }}>
              <Text style={{ fontSize: 9, color: "#888" }}>{file}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* My captured pieces */}
      <CapturedPieces
        pieces={flipped ? capturedPieces.black : capturedPieces.white}
        label={flipped ? "Black captured" : "White captured"}
      />

      {/* Promotion dialog */}
      <PromotionDialog
        visible={!!pendingPromotion}
        color={myColor || "white"}
        onSelect={handlePromotion}
      />
    </View>
  );
}
