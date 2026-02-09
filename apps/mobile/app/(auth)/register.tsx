import { Link, router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { useAuthStore } from "../../stores/authStore";

export default function RegisterScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState("");
  const { register, isLoading, error, clearError } = useAuthStore();

  const handleRegister = async () => {
    setLocalError("");
    clearError();

    if (password !== confirmPassword) {
      setLocalError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setLocalError("Password must be at least 8 characters");
      return;
    }

    const success = await register(email, password, name);
    if (success) {
      router.replace("/(game)/lobby");
    }
  };

  const displayError = localError || error;

  return (
    <View className="flex-1 bg-bg-primary px-6 justify-center items-center">
      <Pressable
        onPress={() => router.back()}
        className="absolute top-16 left-6 z-10 active:opacity-60"
      >
        <Text className="text-text-secondary text-base">&larr; Back</Text>
      </Pressable>

      <View className="w-full max-w-sm">
        <Text className="text-4xl font-bold text-text-primary mb-2">Create account</Text>
        <Text className="text-text-secondary text-lg mb-10">Start your ranked journey</Text>

        {displayError && (
          <View className="bg-red-900/30 border border-red-800 rounded-xl p-3 mb-4">
            <Text className="text-red-400 text-sm">{displayError}</Text>
          </View>
        )}

        <View className="gap-4 mb-6">
          <TextInput
            className="bg-bg-card border border-neutral-800 rounded-xl px-4 py-4 text-text-primary text-base"
            placeholder="Display name"
            placeholderTextColor="#525252"
            autoCorrect={false}
            value={name}
            onChangeText={setName}
          />
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
            placeholder="Password (8+ characters)"
            placeholderTextColor="#525252"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <TextInput
            className="bg-bg-card border border-neutral-800 rounded-xl px-4 py-4 text-text-primary text-base"
            placeholder="Confirm password"
            placeholderTextColor="#525252"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
        </View>

        <Pressable
          className={`bg-accent-primary py-4 rounded-2xl items-center mb-8 ${isLoading ? "opacity-60" : "active:opacity-80"}`}
          onPress={handleRegister}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#f5f5f5" />
          ) : (
            <Text className="text-text-primary text-lg font-semibold">Create Account</Text>
          )}
        </Pressable>

        <View className="flex-row justify-center">
          <Text className="text-text-secondary">Already have an account? </Text>
          <Link href="/(auth)/login" asChild>
            <Pressable>
              <Text className="text-accent-primary font-semibold">Sign in</Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </View>
  );
}
