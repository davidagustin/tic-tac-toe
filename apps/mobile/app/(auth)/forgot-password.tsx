import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { forgotPassword } from "../../services/auth";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) return;
    setError("");
    setIsLoading(true);

    try {
      await forgotPassword(email.trim());
      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinue = () => {
    router.push({
      pathname: "/(auth)/reset-password",
      params: { email: email.trim().toLowerCase() },
    });
  };

  return (
    <View className="flex-1 bg-bg-primary px-6 justify-center">
      <Pressable
        onPress={() => router.back()}
        className="absolute top-16 left-6 z-10 active:opacity-60"
      >
        <Text className="text-text-secondary text-base">&larr; Back</Text>
      </Pressable>

      <Text className="text-4xl font-bold text-text-primary mb-2">Reset password</Text>
      <Text className="text-text-secondary text-lg mb-10">
        {sent
          ? "If an account exists with this email, we've sent a reset code"
          : "Enter your email to receive a reset code"}
      </Text>

      {error ? (
        <Pressable
          onPress={() => setError("")}
          className="bg-red-900/30 border border-red-800 rounded-xl p-3 mb-4"
        >
          <Text className="text-red-400 text-sm">{error}</Text>
        </Pressable>
      ) : null}

      {!sent ? (
        <>
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
          </View>

          <Pressable
            className={`bg-accent-primary py-4 rounded-2xl items-center ${isLoading ? "opacity-60" : "active:opacity-80"}`}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#f5f5f5" />
            ) : (
              <Text className="text-text-primary text-lg font-semibold">Send Reset Code</Text>
            )}
          </Pressable>
        </>
      ) : (
        <Pressable
          className="bg-accent-primary py-4 rounded-2xl items-center active:opacity-80"
          onPress={handleContinue}
        >
          <Text className="text-text-primary text-lg font-semibold">Enter Code</Text>
        </Pressable>
      )}
    </View>
  );
}
