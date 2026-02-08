import type { ChessColor, Player } from "@ttt/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { ChatPanel } from "../../../components/chat/ChatPanel";
import { ChessBoard } from "../../../components/chess/ChessBoard";
import { Board } from "../../../components/game/Board";
import { GameOverModal } from "../../../components/room/GameOverModal";
import { PlayerSlot } from "../../../components/room/PlayerSlot";
import { SpectatorList } from "../../../components/room/SpectatorList";
import { useRoom } from "../../../hooks/useRoom";
import { useAuthStore } from "../../../stores/authStore";

export default function RoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();

  const {
    room,
    chatMessages,
    myRole,
    countdown,
    gameState,
    myMark,
    isMyTurn,
    winningCells,
    rematchOfferedBy,
    iOfferedRematch,
    leaveRoom,
    toggleReady,
    kickPlayer,
    sendChat,
    makeMove,
    forfeit,
    offerRematch,
  } = useRoom(id);

  const handleLeave = useCallback(() => {
    leaveRoom();
    router.back();
  }, [leaveRoom]);

  const isHost = room?.hostId === user?.id;
  const isPlaying = !!gameState && gameState.status === "in_progress";
  const isGameOver =
    !!gameState && gameState.status !== "in_progress" && gameState.status !== "waiting";
  const amPlayer = myRole === "player";
  const isChess = room?.gameType === "chess";

  // Players by mark
  const player1 = isChess
    ? (room?.players.find((p) => p.mark === "white") ?? null)
    : (room?.players.find((p) => p.mark === "X") ?? null);
  const player2 = isChess
    ? (room?.players.find((p) => p.mark === "black") ?? null)
    : (room?.players.find((p) => p.mark === "O") ?? null);

  const mark1 = isChess ? "white" : "X";
  const mark2 = isChess ? "black" : "O";

  // Derive winner for game over modal
  const getWinner = (): Player | ChessColor | null => {
    if (!gameState) return null;
    if (gameState.status === "x_wins") return "X";
    if (gameState.status === "o_wins") return "O";
    if (gameState.status === "white_wins") return "white";
    if (gameState.status === "black_wins") return "black";
    return null;
  };

  // Turn label
  const getTurnLabel = (): string => {
    if (!gameState) return "";
    if (amPlayer) {
      return isMyTurn ? "Your turn!" : "Opponent's turn...";
    }
    if (gameState.gameType === "tic_tac_toe") {
      return `${gameState.currentTurn}'s turn`;
    }
    return `${gameState.currentTurn}'s turn`;
  };

  if (!room) {
    return (
      <View className="flex-1 bg-bg-primary justify-center items-center">
        <Text className="text-text-muted text-base">Loading room...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg-primary">
      {/* Header */}
      <View className="px-6 pt-16 pb-3 flex-row justify-between items-center">
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text className="text-text-primary text-xl font-bold" numberOfLines={1}>
              {room.name}
            </Text>
            <View
              className={`px-2 py-0.5 rounded-full ${isChess ? "bg-amber-500/20" : "bg-blue-500/20"}`}
            >
              <Text
                className={`text-[10px] font-bold ${isChess ? "text-amber-500" : "text-blue-500"}`}
              >
                {isChess ? "CHESS" : "TTT"}
              </Text>
            </View>
          </View>
          <Text className="text-text-muted text-xs">
            Room {room.id} {room.hasPassword ? "🔒" : ""}
          </Text>
        </View>
        <Pressable
          className="bg-bg-card border border-neutral-800 px-4 py-2 rounded-xl active:opacity-80"
          onPress={handleLeave}
        >
          <Text className="text-text-secondary font-semibold text-sm">Leave</Text>
        </Pressable>
      </View>

      {/* Countdown overlay */}
      {countdown !== null && countdown > 0 && (
        <View className="absolute top-0 left-0 right-0 bottom-0 z-50 bg-black/80 justify-center items-center">
          <Text className="text-accent-primary text-6xl font-bold">{countdown}</Text>
          <Text className="text-text-secondary text-lg mt-2">Game starting...</Text>
        </View>
      )}

      <ScrollView className="flex-1" contentContainerClassName="px-6 pb-6">
        {/* Player slots */}
        <View className="gap-3 mb-4">
          <PlayerSlot
            member={player1}
            mark={mark1}
            isHost={player1?.userId === room.hostId}
            canKick={isHost && player1?.userId !== user?.id && !isPlaying}
            onKick={() => player1 && kickPlayer(player1.userId)}
          />
          <View className="items-center">
            <Text className="text-text-muted text-xs font-bold">VS</Text>
          </View>
          <PlayerSlot
            member={player2}
            mark={mark2}
            isHost={player2?.userId === room.hostId}
            canKick={isHost && player2?.userId !== user?.id && !isPlaying}
            onKick={() => player2 && kickPlayer(player2.userId)}
          />
        </View>

        {/* Spectators */}
        <SpectatorList spectators={room.spectators} />

        {/* Ready / Game Area */}
        {!isPlaying && !isGameOver && amPlayer && (
          <Pressable
            className={`mt-4 py-3 rounded-xl items-center active:opacity-80 ${
              room.players.find((p) => p.userId === user?.id)?.isReady
                ? "bg-green-500/20 border border-green-500"
                : "bg-accent-primary"
            }`}
            onPress={toggleReady}
          >
            <Text className="text-text-primary font-semibold">
              {room.players.find((p) => p.userId === user?.id)?.isReady
                ? "Ready! Waiting..."
                : "Ready Up"}
            </Text>
          </Pressable>
        )}

        {!isPlaying && !isGameOver && !amPlayer && (
          <View className="mt-4 py-3 items-center">
            <Text className="text-text-muted text-sm">Spectating - waiting for game to start</Text>
          </View>
        )}

        {/* Game Board */}
        {(isPlaying || isGameOver) && gameState && (
          <View className="mt-4 items-center">
            {isPlaying && (
              <Text
                className={`text-lg font-bold mb-3 ${isMyTurn ? "text-green-500" : "text-text-muted"}`}
              >
                {getTurnLabel()}
              </Text>
            )}

            {gameState.gameType === "tic_tac_toe" ? (
              <Board
                board={gameState.board}
                onCellPress={(pos) => makeMove({ gameType: "tic_tac_toe", position: pos })}
                disabled={!isMyTurn || !amPlayer}
                winningCells={winningCells}
              />
            ) : (
              <ChessBoard
                fen={gameState.fen}
                myColor={
                  (myMark === "white" || myMark === "black" ? myMark : null) as ChessColor | null
                }
                isMyTurn={isMyTurn}
                disabled={!amPlayer}
                lastMove={gameState.lastMove}
                isCheck={gameState.isCheck}
                capturedPieces={gameState.capturedPieces}
                onMove={(from, to, promotion) =>
                  makeMove({ gameType: "chess", from, to, promotion })
                }
              />
            )}

            {isPlaying && amPlayer && (
              <Pressable
                className="mt-4 bg-accent-o/20 border border-accent-o px-6 py-2 rounded-xl active:opacity-80"
                onPress={forfeit}
              >
                <Text className="text-accent-o font-semibold text-sm">Forfeit</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Room Chat */}
        <View className="mt-6 h-64 bg-bg-card rounded-2xl border border-neutral-800 overflow-hidden">
          <View className="px-3 py-2 border-b border-neutral-800">
            <Text className="text-text-muted text-xs font-semibold">Room Chat</Text>
          </View>
          <ChatPanel messages={chatMessages} onSend={sendChat} myUserId={user?.id || ""} />
        </View>
      </ScrollView>

      {/* Game Over Modal */}
      <GameOverModal
        visible={isGameOver}
        winner={getWinner()}
        myMark={myMark}
        iOfferedRematch={iOfferedRematch}
        rematchOfferedBy={rematchOfferedBy}
        onRematch={offerRematch}
        onLeave={handleLeave}
        gameType={room.gameType}
      />
    </View>
  );
}
