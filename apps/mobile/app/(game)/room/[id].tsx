import { router, useLocalSearchParams } from "expo-router";
import { useCallback } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { ChatPanel } from "../../../components/chat/ChatPanel";
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

  // Player X is always first in the players array by convention
  const playerX = room?.players.find((p) => p.mark === "X") ?? null;
  const playerO = room?.players.find((p) => p.mark === "O") ?? null;

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
          <Text className="text-text-primary text-xl font-bold" numberOfLines={1}>
            {room.name}
          </Text>
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
            member={playerX}
            mark="X"
            isHost={playerX?.userId === room.hostId}
            canKick={isHost && playerX?.userId !== user?.id && !isPlaying}
            onKick={() => playerX && kickPlayer(playerX.userId)}
          />
          <View className="items-center">
            <Text className="text-text-muted text-xs font-bold">VS</Text>
          </View>
          <PlayerSlot
            member={playerO}
            mark="O"
            isHost={playerO?.userId === room.hostId}
            canKick={isHost && playerO?.userId !== user?.id && !isPlaying}
            onKick={() => playerO && kickPlayer(playerO.userId)}
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
                {amPlayer
                  ? isMyTurn
                    ? "Your turn!"
                    : "Opponent's turn..."
                  : `${gameState.currentTurn}'s turn`}
              </Text>
            )}

            <Board
              board={gameState.board}
              onCellPress={makeMove}
              disabled={!isMyTurn || !amPlayer}
              winningCells={winningCells}
            />

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
        winner={gameState?.status === "x_wins" ? "X" : gameState?.status === "o_wins" ? "O" : null}
        myMark={myMark}
        iOfferedRematch={iOfferedRematch}
        rematchOfferedBy={rematchOfferedBy}
        onRematch={offerRematch}
        onLeave={handleLeave}
      />
    </View>
  );
}
