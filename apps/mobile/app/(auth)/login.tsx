import { Link, router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { ActivityIndicator, Platform, Pressable, Text, TextInput, View } from "react-native";
import { API_URL } from "../../config/api";
import { useAuthStore } from "../../stores/authStore";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login, isLoading, error, clearError } = useAuthStore();

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      return;
    }
    const success = await login(email.trim(), password);
    if (success) {
      router.replace("/(game)/lobby");
    }
  };

  const handleGoogleLogin = async () => {
    if (Platform.OS === "web") {
      // On web, navigate directly — server will redirect back to /auth/callback
      window.location.href = `${API_URL}/api/auth/google?platform=web`;
    } else {
      await WebBrowser.openBrowserAsync(`${API_URL}/api/auth/google`);
    }
  };

  return (
    <View className="flex-1 bg-bg-primary px-6 justify-center items-center">
      <Pressable
        onPress={() => router.back()}
        className="absolute top-16 left-6 z-10 active:opacity-60"
      >
        <Text className="text-text-secondary text-base">&larr; Back</Text>
      </Pressable>

      <View className="w-full max-w-sm">
        <Text className="text-4xl font-bold text-text-primary mb-2">Welcome back</Text>
        <Text className="text-text-secondary text-lg mb-10">Sign in to play online</Text>

        {error && (
          <Pressable
            onPress={clearError}
            className="bg-red-900/30 border border-red-800 rounded-xl p-3 mb-4"
          >
            <Text className="text-red-400 text-sm">{error}</Text>
          </Pressable>
        )}

        <View className="gap-4 mb-6">
          <TextInput
            className="bg-bg-card border border-neutral-800 rounded-xl px-4 py-4 text-text-primary text-base"
            placeholder="Email"
            placeholderTextColor="#525252"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            className="bg-bg-card border border-neutral-800 rounded-xl px-4 py-4 text-text-primary text-base"
            placeholder="Password"
            placeholderTextColor="#525252"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        <View className="items-end mb-4">
          <Link href="/(auth)/forgot-password" asChild>
            <Pressable>
              <Text className="text-text-muted text-sm">Forgot password?</Text>
            </Pressable>
          </Link>
        </View>

        <Pressable
          className={`bg-accent-primary py-4 rounded-2xl items-center mb-4 ${isLoading ? "opacity-60" : "active:opacity-80"}`}
          onPress={handleLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#f5f5f5" />
          ) : (
            <Text className="text-text-primary text-lg font-semibold">Sign In</Text>
          )}
        </Pressable>

        {/* Divider */}
        <View className="flex-row items-center my-4">
          <View className="flex-1 h-px bg-neutral-800" />
          <Text className="text-text-muted mx-4">or</Text>
          <View className="flex-1 h-px bg-neutral-800" />
        </View>

        {/* Google OAuth */}
        <Pressable
          className="bg-bg-card border border-neutral-800 py-4 rounded-2xl items-center flex-row justify-center gap-2 mb-8 active:opacity-80"
          onPress={handleGoogleLogin}
        >
          <Text className="text-text-primary text-lg">Continue with Google</Text>
        </Pressable>

        {/* Register Link */}
        <View className="flex-row justify-center">
          <Text className="text-text-secondary">Don't have an account? </Text>
          <Link href="/(auth)/register" asChild>
            <Pressable>
              <Text className="text-accent-primary font-semibold">Sign up</Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </View>
  );
}
