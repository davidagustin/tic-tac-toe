import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { api, saveTokens } from '../../services/auth';

export default function AuthCallbackScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!code) {
      setError('No authorization code received');
      return;
    }

    (async () => {
      try {
        const { data } = await api.post('/api/auth/oauth/exchange', { code });

        if (data.success) {
          await saveTokens(data.data.accessToken, data.data.refreshToken);
          await useAuthStore.getState().loadUser();
          router.replace('/(game)/lobby');
        } else {
          setError(data.error || 'Failed to sign in');
        }
      } catch {
        setError('Authentication failed. Please try again.');
      }
    })();
  }, [code]);

  if (error) {
    return (
      <View className="flex-1 bg-bg-primary items-center justify-center px-6">
        <Text className="text-red-400 text-lg mb-4">{error}</Text>
        <Pressable onPress={() => router.replace('/(auth)/login')}>
          <Text className="text-accent-primary text-base font-semibold">Back to Login</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg-primary items-center justify-center">
      <ActivityIndicator size="large" color="#8b5cf6" />
      <Text className="text-text-secondary mt-4">Signing you in...</Text>
    </View>
  );
}
