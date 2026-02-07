import type { RoomInfo } from "@ttt/shared";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Linking, Pressable, Text, View } from "react-native";
import { CryptoDonations } from "../../components/CryptoDonations";
import { ChatPanel } from "../../components/chat/ChatPanel";
import { CreateRoomModal } from "../../components/lobby/CreateRoomModal";
import { PasswordModal } from "../../components/lobby/PasswordModal";
import { RoomCard } from "../../components/lobby/RoomCard";
import { useLobby } from "../../hooks/useLobby";
import { useAuthStore } from "../../stores/authStore";

const STRIPE_DONATE_URL = "https://buy.stripe.com/fZucN5epreyuchqdtZfnO00";

type Tab = "rooms" | "chat";

export default function LobbyScreen() {
  const { user, isGuest, logout } = useAuthStore();
  const { rooms, chatMessages, onlineCount, isConnected, sendChat, createRoom, joinRoom } =
    useLobby();

  const [activeTab, setActiveTab] = useState<Tab>("rooms");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Password modal state
  const [passwordRoom, setPasswordRoom] = useState<RoomInfo | null>(null);
  const [passwordError, setPasswordError] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.replace("/");
  };

  const handleCreateRoom = useCallback(
    async (name: string, password?: string) => {
      setIsCreating(true);
      const result = await createRoom(name, password);
      setIsCreating(false);

      if (result.success && result.roomId) {
        setShowCreateModal(false);
        router.push(`/(game)/room/${result.roomId}` as any);
      }
    },
    [createRoom],
  );

  const handleJoinRoom = useCallback(
    async (roomId: string) => {
      const room = rooms.find((r) => r.id === roomId);
      if (!room) return;

      if (room.hasPassword) {
        setPasswordRoom(room);
        setPasswordError("");
        return;
      }

      setIsJoining(true);
      const result = await joinRoom(roomId);
      setIsJoining(false);

      if (result.success) {
        router.push(`/(game)/room/${roomId}` as any);
      }
    },
    [rooms, joinRoom],
  );

  const handlePasswordSubmit = useCallback(
    async (password: string) => {
      if (!passwordRoom) return;
      setIsJoining(true);
      const result = await joinRoom(passwordRoom.id, password);
      setIsJoining(false);

      if (result.success) {
        setPasswordRoom(null);
        router.push(`/(game)/room/${passwordRoom.id}` as any);
      } else {
        setPasswordError(result.error || "Wrong password");
      }
    },
    [passwordRoom, joinRoom],
  );

  const renderRoom = useCallback(
    ({ item }: { item: RoomInfo }) => <RoomCard room={item} onJoin={handleJoinRoom} />,
    [handleJoinRoom],
  );

  return (
    <View className="flex-1 bg-bg-primary">
      {/* Header */}
      <View className="px-6 pt-16 pb-4">
        <View className="flex-row justify-between items-center mb-4">
          <View>
            <Text className="text-text-secondary text-sm">
              {isGuest ? "Playing as guest" : "Welcome back"}
            </Text>
            <Text className="text-text-primary text-2xl font-bold">{user?.name}</Text>
          </View>
          <View className="flex-row items-center gap-4">
            <View className="flex-row items-center gap-1.5">
              <View
                className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}
              />
              <Text className="text-text-muted text-xs">{onlineCount} online</Text>
            </View>
            <Pressable onPress={handleLogout} className="active:opacity-60">
              <Text className="text-text-secondary">{isGuest ? "Exit" : "Logout"}</Text>
            </Pressable>
          </View>
        </View>

        {/* Rating card */}
        <View className="flex-row gap-3 mb-4">
          <View className="flex-1 bg-bg-card rounded-xl p-3 border border-neutral-800">
            <Text className="text-text-muted text-xs">Rating</Text>
            <Text className="text-accent-primary text-2xl font-bold">{user?.rating || 1000}</Text>
          </View>
          <View className="flex-1 bg-bg-card rounded-xl p-3 border border-neutral-800">
            <Text className="text-text-muted text-xs">Games</Text>
            <Text className="text-text-primary text-2xl font-bold">
              {user?.stats.gamesPlayed || 0}
            </Text>
          </View>
        </View>

        {isGuest && (
          <Pressable
            className="bg-accent-primary/20 border border-accent-primary rounded-xl p-3 mb-4 active:opacity-80"
            onPress={() => router.push("/(auth)/register")}
          >
            <Text className="text-accent-primary text-center text-sm font-semibold">
              Create an account to create rooms and save progress
            </Text>
          </Pressable>
        )}

        {/* Action buttons */}
        <View className="flex-row gap-3 mb-4">
          {!isGuest && (
            <Pressable
              className="flex-1 bg-accent-primary py-3 rounded-xl items-center active:opacity-80"
              onPress={() => setShowCreateModal(true)}
            >
              <Text className="text-text-primary font-semibold">Create Room</Text>
            </Pressable>
          )}
          <Pressable
            className="flex-1 bg-bg-card border border-neutral-800 py-3 rounded-xl items-center active:opacity-80"
            onPress={() => router.push("/local-game")}
          >
            <Text className="text-text-primary font-semibold">Local Game</Text>
          </Pressable>
        </View>

        {/* Tabs */}
        <View className="flex-row bg-bg-card rounded-xl border border-neutral-800 p-1">
          <Pressable
            className={`flex-1 py-2 rounded-lg items-center ${activeTab === "rooms" ? "bg-bg-secondary" : ""}`}
            onPress={() => setActiveTab("rooms")}
          >
            <Text
              className={`font-semibold text-sm ${activeTab === "rooms" ? "text-text-primary" : "text-text-muted"}`}
            >
              Rooms ({rooms.length})
            </Text>
          </Pressable>
          <Pressable
            className={`flex-1 py-2 rounded-lg items-center ${activeTab === "chat" ? "bg-bg-secondary" : ""}`}
            onPress={() => setActiveTab("chat")}
          >
            <Text
              className={`font-semibold text-sm ${activeTab === "chat" ? "text-text-primary" : "text-text-muted"}`}
            >
              Lobby Chat
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Content */}
      {activeTab === "rooms" ? (
        <FlatList
          data={rooms}
          keyExtractor={(item) => item.id}
          renderItem={renderRoom}
          contentContainerClassName="px-6 pb-6 gap-3"
          ListEmptyComponent={
            <View className="items-center py-12">
              <Text className="text-text-muted text-base mb-2">No rooms yet</Text>
              <Text className="text-text-muted text-sm">
                {isGuest ? "Join a room or play locally" : "Create one to start playing!"}
              </Text>
            </View>
          }
        />
      ) : (
        <ChatPanel messages={chatMessages} onSend={sendChat} myUserId={user?.id || ""} />
      )}

      {/* Footer */}
      <View className="flex-row justify-center items-center gap-2 pb-4 opacity-50">
        <Pressable
          onPress={() => Linking.openURL(STRIPE_DONATE_URL)}
          className="active:opacity-80"
          hitSlop={12}
        >
          <View className="w-6 h-6 rounded-full items-center justify-center bg-[#635bff]">
            <Text className="text-white text-[9px] font-bold">S</Text>
          </View>
        </Pressable>
        <CryptoDonations />
      </View>

      {/* Modals */}
      <CreateRoomModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateRoom}
        isLoading={isCreating}
      />

      {passwordRoom && (
        <PasswordModal
          visible={!!passwordRoom}
          roomName={passwordRoom.name}
          onClose={() => setPasswordRoom(null)}
          onSubmit={handlePasswordSubmit}
          isLoading={isJoining}
          error={passwordError}
        />
      )}
    </View>
  );
}
