import { useState } from "react";
import { Modal, Pressable, Text, TextInput, View } from "react-native";

interface PasswordModalProps {
  visible: boolean;
  roomName: string;
  onClose: () => void;
  onSubmit: (password: string) => Promise<void>;
  isLoading: boolean;
  error: string;
}

export function PasswordModal({
  visible,
  roomName,
  onClose,
  onSubmit,
  isLoading,
  error,
}: PasswordModalProps) {
  const [password, setPassword] = useState("");

  const handleSubmit = async () => {
    if (!password) return;
    await onSubmit(password);
  };

  const handleClose = () => {
    setPassword("");
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
          <Text className="text-text-primary text-xl font-bold mb-2">Enter Password</Text>
          <Text className="text-text-secondary text-sm mb-6">{roomName}</Text>

          <TextInput
            className="bg-bg-secondary text-text-primary rounded-xl px-4 py-3 mb-2 border border-neutral-700"
            placeholder="Room password"
            placeholderTextColor="#525252"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoFocus
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
              onPress={handleSubmit}
              disabled={isLoading}
            >
              <Text className="text-text-primary font-semibold">
                {isLoading ? "Joining..." : "Join"}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
