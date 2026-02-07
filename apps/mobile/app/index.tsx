import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';

export default function HomeScreen() {
  return (
    <View className="flex-1 bg-bg-primary items-center justify-center px-6">
      {/* Logo / Title */}
      <Text className="text-5xl font-bold text-text-primary mb-2 tracking-tight">
        TIC TAC TOE
      </Text>
      <Text className="text-text-secondary text-lg mb-12">
        Play online. Climb the ranks.
      </Text>

      {/* Menu Buttons */}
      <View className="w-full max-w-sm gap-4">
        <Pressable
          className="bg-accent-primary py-4 rounded-2xl items-center active:opacity-80"
          onPress={() => router.push('/local-game')}
        >
          <Text className="text-text-primary text-lg font-semibold">
            Local Game
          </Text>
        </Pressable>

        <Pressable
          className="bg-bg-card border border-neutral-800 py-4 rounded-2xl items-center active:opacity-80"
          onPress={() => router.push('/(auth)/login')}
        >
          <Text className="text-text-primary text-lg font-semibold">
            Play Online
          </Text>
        </Pressable>

        <Pressable
          className="bg-bg-card border border-neutral-800 py-4 rounded-2xl items-center active:opacity-80"
          onPress={() => router.push('/(game)/lobby')}
        >
          <Text className="text-text-primary text-lg font-semibold">
            Continue as Guest
          </Text>
        </Pressable>

        <Pressable
          className="py-4 items-center active:opacity-80"
          onPress={() => router.push('/(profile)/leaderboard')}
        >
          <Text className="text-text-secondary text-base">
            Leaderboard
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
