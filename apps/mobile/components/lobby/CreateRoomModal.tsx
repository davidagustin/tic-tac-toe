import { ROOM_CONFIG } from "@ttt/shared";
import { useState } from "react";
import { Modal, Pressable, Text, TextInput, View } from "react-native";

interface CreateRoomModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string, password?: string) => Promise<void>;
  isLoading: boolean;
}

export function CreateRoomModal({ visible, onClose, onCreate, isLoading }: CreateRoomModalProps) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Room name is required");
      return;
    }
    if (trimmed.length > ROOM_CONFIG.MAX_NAME_LENGTH) {
      setError(`Max ${ROOM_CONFIG.MAX_NAME_LENGTH} characters`);
      return;
    }
    setError("");
    await onCreate(trimmed, password || undefined);
  };

  const handleClose = () => {
    setName("");
    setPassword("");
    setError("");
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable
        className="flex-1 bg-black/60 justify-center items-center px-6"
        onPress={handleClose}
      >
        <Pressable
          className="bg-bg-card w-full rounded-2xl p-6 border border-neutral-800"
          onPress={() => {}}
        >
          <Text className="text-text-primary text-xl font-bold mb-6">Create Room</Text>

          <Text className="text-text-secondary text-sm mb-2">Room Name</Text>
          <TextInput
            className="bg-bg-secondary text-text-primary rounded-xl px-4 py-3 mb-4 border border-neutral-700"
            placeholder="My awesome room"
            placeholderTextColor="#525252"
            value={name}
            onChangeText={setName}
            maxLength={ROOM_CONFIG.MAX_NAME_LENGTH}
            autoFocus
          />

          <Text className="text-text-secondary text-sm mb-2">Password (optional)</Text>
          <TextInput
            className="bg-bg-secondary text-text-primary rounded-xl px-4 py-3 mb-2 border border-neutral-700"
            placeholder="Leave blank for public room"
            placeholderTextColor="#525252"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {error ? (
            <Text className="text-accent-o text-sm mb-4">{error}</Text>
          ) : (
            <View className="mb-4" />
          )}

          <View className="flex-row gap-3">
            <Pressable
              className="flex-1 py-3 rounded-xl border border-neutral-700 items-center active:opacity-80"
              onPress={handleClose}
            >
              <Text className="text-text-secondary font-semibold">Cancel</Text>
            </Pressable>
            <Pressable
              className={`flex-1 py-3 rounded-xl items-center active:opacity-80 ${isLoading ? "bg-accent-primary/50" : "bg-accent-primary"}`}
              onPress={handleCreate}
              disabled={isLoading}
            >
              <Text className="text-text-primary font-semibold">
                {isLoading ? "Creating..." : "Create"}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
