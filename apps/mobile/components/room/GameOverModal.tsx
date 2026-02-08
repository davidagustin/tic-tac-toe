import type { ChessColor, GameType, Player, PlayerSide } from "@ttt/shared";
import { Modal, Pressable, Text, View } from "react-native";

interface GameOverModalProps {
  visible: boolean;
  winner: Player | ChessColor | null;
  myMark: PlayerSide | null;
  iOfferedRematch: boolean;
  rematchOfferedBy: string | null;
  onRematch: () => void;
  onLeave: () => void;
  gameType?: GameType;
}

export function GameOverModal({
  visible,
  winner,
  myMark,
  iOfferedRematch,
  rematchOfferedBy,
  onRematch,
  onLeave,
  gameType = "tic_tac_toe",
}: GameOverModalProps) {
  const isDraw = winner === null;
  const iWon = winner === myMark;
  const isSpectator = myMark === null;
  const isChess = gameType === "chess";

  let title = "Draw!";
  let subtitle = isChess ? "Neither side could prevail" : "Well played by both sides";
  let titleColor = "text-text-primary";

  if (!isDraw) {
    if (isSpectator) {
      if (isChess) {
        title = `${winner === "white" ? "White" : "Black"} Wins!`;
        subtitle = "Great game to watch";
        titleColor = winner === "white" ? "text-white" : "text-neutral-300";
      } else {
        title = `${winner} Wins!`;
        subtitle = "Great game to watch";
        titleColor = winner === "X" ? "text-accent-x" : "text-accent-o";
      }
    } else if (iWon) {
      title = isChess ? "Checkmate!" : "You Win!";
      subtitle = "Excellent play!";
      titleColor = "text-green-500";
    } else {
      title = isChess ? "Checkmate" : "You Lose";
      subtitle = "Better luck next time";
      titleColor = "text-accent-o";
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 bg-black/60 justify-center items-center px-6">
        <View className="bg-bg-card w-full rounded-2xl p-6 border border-neutral-800 items-center">
          <Text className={`text-3xl font-bold mb-2 ${titleColor}`}>{title}</Text>
          <Text className="text-text-secondary mb-6">{subtitle}</Text>

          {rematchOfferedBy && !iOfferedRematch && (
            <Text className="text-accent-primary text-sm mb-4">Opponent wants a rematch!</Text>
          )}

          {!isSpectator && (
            <Pressable
              className={`w-full py-3 rounded-xl items-center mb-3 active:opacity-80 ${
                iOfferedRematch ? "bg-accent-primary/30" : "bg-accent-primary"
              }`}
              onPress={onRematch}
              disabled={iOfferedRematch}
            >
              <Text className="text-text-primary font-semibold">
                {iOfferedRematch ? "Waiting for opponent..." : "Rematch"}
              </Text>
            </Pressable>
          )}

          <Pressable
            className="w-full py-3 rounded-xl border border-neutral-700 items-center active:opacity-80"
            onPress={onLeave}
          >
            <Text className="text-text-secondary font-semibold">Leave Room</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
