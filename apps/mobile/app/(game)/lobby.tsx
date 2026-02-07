import { View, Text, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { CryptoDonations } from '../../components/CryptoDonations';

export default function LobbyScreen() {
  const { user, isGuest, logout } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  return (
    <ScrollView className="flex-1 bg-bg-primary" contentContainerClassName="px-6 pt-16 pb-12">
      <View className="flex-row justify-between items-center mb-8">
        <View>
          <Text className="text-text-secondary text-sm">
            {isGuest ? 'Playing as guest' : 'Welcome back'}
          </Text>
          <Text className="text-text-primary text-2xl font-bold">{user?.name}</Text>
        </View>
        <Pressable onPress={handleLogout} className="active:opacity-60">
          <Text className="text-text-secondary">{isGuest ? 'Exit' : 'Logout'}</Text>
        </Pressable>
      </View>

      <View className="bg-bg-card rounded-2xl p-6 border border-neutral-800 mb-6">
        <Text className="text-text-secondary text-sm mb-1">Rating</Text>
        <Text className="text-accent-primary text-4xl font-bold">{user?.rating || 1000}</Text>
      </View>

      {isGuest && (
        <Pressable
          className="bg-accent-primary/20 border border-accent-primary rounded-xl p-4 mb-6 active:opacity-80"
          onPress={() => router.push('/(auth)/register')}
        >
          <Text className="text-accent-primary text-center font-semibold">
            Create an account to play online and save progress
          </Text>
        </Pressable>
      )}

      <View className="gap-4">
        <Pressable
          className={`py-4 rounded-2xl items-center ${isGuest ? 'bg-neutral-800' : 'bg-accent-primary active:opacity-80'}`}
          onPress={() => {
            if (isGuest) {
              router.push('/(auth)/register');
            } else {
              /* Phase 2: matchmaking */
            }
          }}
        >
          <Text className="text-text-primary text-lg font-semibold">
            {isGuest ? 'Sign Up to Find Match' : 'Find Match'}
          </Text>
        </Pressable>

        <Pressable
          className="bg-bg-card border border-neutral-800 py-4 rounded-2xl items-center active:opacity-80"
          onPress={() => router.push('/local-game')}
        >
          <Text className="text-text-primary text-lg font-semibold">Local Game</Text>
        </Pressable>
      </View>

      <Text className="text-text-muted text-center mt-8 mb-8 text-sm">
        Online matchmaking & chat coming in Phase 2
      </Text>

      <CryptoDonations />
    </ScrollView>
  );
}
