import type { CellValue } from "@ttt/shared";
import * as Haptics from "expo-haptics";
import { Platform, Pressable, Text } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface CellProps {
  value: CellValue;
  index: number;
  onPress: (index: number) => void;
  disabled: boolean;
  isWinningCell: boolean;
}

export function Cell({ value, index, onPress, disabled, isWinningCell }: CellProps) {
  const scale = useSharedValue(1);

  const handlePress = () => {
    if (disabled || value !== null) return;

    // Haptic feedback on move (native only)
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    // Pop animation
    scale.value = withSequence(
      withSpring(1.2, { damping: 4, stiffness: 300 }),
      withSpring(1, { damping: 8, stiffness: 200 }),
    );

    onPress(index);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Determine cell borders based on position (3x3 grid)
  const row = Math.floor(index / 3);
  const col = index % 3;
  const borderClasses = [
    col < 2 ? "border-r border-neutral-700" : "",
    row < 2 ? "border-b border-neutral-700" : "",
  ].join(" ");

  const textColor = value === "X" ? "text-accent-x" : "text-accent-o";
  const winHighlight = isWinningCell ? "bg-accent-primary/10" : "";

  return (
    <AnimatedPressable
      style={animatedStyle}
      className={`w-full aspect-square items-center justify-center ${borderClasses} ${winHighlight}`}
      onPress={handlePress}
      disabled={disabled}
    >
      {value && <Text className={`text-5xl font-bold ${textColor}`}>{value}</Text>}
    </AnimatedPressable>
  );
}
