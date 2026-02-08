import type { ChatMessage } from "@ttt/shared";
import { CHAT_CONFIG } from "@ttt/shared";
import { useCallback, useRef, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  myUserId: string;
}

function formatTimestamp(isoString: string): string {
  return new Date(isoString).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ChatPanel({ messages, onSend, myUserId }: ChatPanelProps) {
  const [text, setText] = useState("");
  const flatListRef = useRef<FlatList>(null);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
  }, [text, onSend]);

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessage }) => {
      const isMe = item.userId === myUserId;
      return (
        <View className={`mb-1.5 ${isMe ? "items-end" : "items-start"}`}>
          <View
            className={`max-w-[80%] px-3 py-1.5 rounded-xl ${isMe ? "bg-accent-primary/20" : "bg-bg-secondary"}`}
          >
            {!isMe && (
              <Text className="text-accent-primary text-xs font-semibold mb-0.5">
                {item.userName}
              </Text>
            )}
            <View className="flex-row flex-wrap items-end">
              <Text className="text-text-primary text-sm flex-shrink">{item.text}</Text>
              <Text className="text-text-muted text-[9px] ml-2 opacity-60">
                {formatTimestamp(item.timestamp)}
              </Text>
            </View>
          </View>
        </View>
      );
    },
    [myUserId],
  );

  return (
    <View className="flex-1">
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerClassName="px-3 py-2"
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
      />
      <View className="flex-row items-center px-3 pb-2 gap-2">
        <TextInput
          className="flex-1 bg-bg-secondary text-text-primary rounded-xl px-4 py-2 border border-neutral-700"
          placeholder="Type a message..."
          placeholderTextColor="#525252"
          value={text}
          onChangeText={setText}
          maxLength={CHAT_CONFIG.MAX_MESSAGE_LENGTH}
          onSubmitEditing={handleSend}
          returnKeyType="send"
        />
        <Pressable
          className="bg-accent-primary px-4 py-2 rounded-xl active:opacity-80"
          onPress={handleSend}
        >
          <Text className="text-text-primary font-semibold">Send</Text>
        </Pressable>
      </View>
    </View>
  );
}
