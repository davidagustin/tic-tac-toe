import { useEffect, useRef } from "react";
import { Animated, View } from "react-native";

export function ThinkingIndicator() {
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [fadeAnim]);

  return (
    <View className="flex-row items-center justify-center py-2">
      <Animated.Text style={{ opacity: fadeAnim }} className="text-text-muted text-sm">
        Computer is thinking...
      </Animated.Text>
    </View>
  );
}
