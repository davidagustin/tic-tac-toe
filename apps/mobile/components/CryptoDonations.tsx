import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useCallback, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";

interface WalletAddress {
  label: string;
  symbol: string;
  address: string;
  color: string;
}

const WALLETS: WalletAddress[] = [
  {
    label: "Bitcoin",
    symbol: "BTC",
    address: "bc1qkqrp0v0av6ch6ekm2e2scav93a0d83mawcjcd3",
    color: "#f7931a",
  },
  {
    label: "Ethereum",
    symbol: "ETH",
    address: "0x846a124b1438f5dc657309e686c57b03647888f2",
    color: "#627eea",
  },
];

function WalletRow({ wallet }: { wallet: WalletAddress }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await Clipboard.setStringAsync(wallet.address);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [wallet.address]);

  const _truncated = `${wallet.address.slice(0, 8)}...${wallet.address.slice(-6)}`;

  return (
    <Pressable
      onPress={handleCopy}
      className="flex-row items-center gap-1.5 bg-bg-card border border-neutral-800 px-3 py-1.5 rounded-full active:opacity-70"
      hitSlop={8}
    >
      <View
        style={{ backgroundColor: copied ? "#22c55e" : wallet.color }}
        className="w-4 h-4 rounded-full items-center justify-center"
      >
        <Text className="text-white text-[7px] font-bold">{copied ? "\u2713" : wallet.symbol}</Text>
      </View>
      <Text className="text-text-muted text-xs">{copied ? "Copied" : wallet.symbol}</Text>
    </Pressable>
  );
}

export function CryptoDonations() {
  return (
    <View className="flex-row gap-2">
      {WALLETS.map((wallet) => (
        <WalletRow key={wallet.symbol} wallet={wallet} />
      ))}
    </View>
  );
}
