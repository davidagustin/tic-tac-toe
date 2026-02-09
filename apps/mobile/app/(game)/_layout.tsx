import { Stack, useRouter } from "expo-router";
import { useEffect } from "react";
import { useAuthStore } from "../../stores/authStore";

export default function GameLayout() {
  const { isAuthenticated, isGuest } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated && !isGuest) {
      router.replace("/");
    }
  }, [isAuthenticated, isGuest]);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#0a0a0a" } }} />
  );
}
