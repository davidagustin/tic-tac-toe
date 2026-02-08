import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { forgotPassword, resetPassword } from "../../services/auth";

export default function ResetPasswordScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleResend = async () => {
    if (resendCooldown > 0 || !email) return;
    try {
      await forgotPassword(email);
      setResendCooldown(60);
    } catch {
      setError("Failed to resend code");
    }
  };

  const handleSubmit = async () => {
    setError("");

    if (!code || code.length !== 6) {
      setError("Please enter the 6-digit code");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (!email) {
      setError("Missing email");
      return;
    }

    setIsLoading(true);
    try {
      const data = await resetPassword(email, code, newPassword);
      if (data.success) {
        router.replace("/(auth)/login");
      } else {
        setError(data.error || "Failed to reset password");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-bg-primary px-6 justify-center">
      <Pressable
        onPress={() => router.back()}
        className="absolute top-16 left-6 z-10 active:opacity-60"
      >
        <Text className="text-text-secondary text-base">&larr; Back</Text>
      </Pressable>

      <Text className="text-4xl font-bold text-text-primary mb-2">New password</Text>
      <Text className="text-text-secondary text-lg mb-10">Enter the code sent to {email}</Text>

      {error ? (
        <Pressable
          onPress={() => setError("")}
          className="bg-red-900/30 border border-red-800 rounded-xl p-3 mb-4"
        >
          <Text className="text-red-400 text-sm">{error}</Text>
        </Pressable>
      ) : null}

      <View className="gap-4 mb-6">
        <TextInput
          className="bg-bg-card border border-neutral-800 rounded-xl px-4 py-4 text-text-primary text-base text-center tracking-widest"
          placeholder="000000"
          placeholderTextColor="#525252"
          keyboardType="number-pad"
          maxLength={6}
          value={code}
          onChangeText={setCode}
        />
        <TextInput
          className="bg-bg-card border border-neutral-800 rounded-xl px-4 py-4 text-text-primary text-base"
          placeholder="New password"
          placeholderTextColor="#525252"
          secureTextEntry
          value={newPassword}
          onChangeText={setNewPassword}
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
        className={`bg-accent-primary py-4 rounded-2xl items-center mb-4 ${isLoading ? "opacity-60" : "active:opacity-80"}`}
        onPress={handleSubmit}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#f5f5f5" />
        ) : (
          <Text className="text-text-primary text-lg font-semibold">Reset Password</Text>
        )}
      </Pressable>

      <Pressable onPress={handleResend} disabled={resendCooldown > 0}>
        <Text className="text-text-muted text-sm text-center">
          {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Didn't get a code? Resend"}
        </Text>
      </Pressable>
    </View>
  );
}
