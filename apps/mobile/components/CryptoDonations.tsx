import { useState, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';

interface WalletAddress {
  label: string;
  symbol: string;
  address: string;
  color: string;
}

const WALLETS: WalletAddress[] = [
  {
    label: 'Bitcoin',
    symbol: 'BTC',
    address: 'bc1qkqrp0v0av6ch6ekm2e2scav93a0d83mawcjcd3',
    color: '#f7931a',
  },
  {
    label: 'Ethereum',
    symbol: 'ETH',
    address: '0x846a124b1438f5dc657309e686c57b03647888f2',
    color: '#627eea',
  },
];

function WalletRow({ wallet }: { wallet: WalletAddress }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await Clipboard.setStringAsync(wallet.address);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [wallet.address]);

  const truncated = `${wallet.address.slice(0, 8)}...${wallet.address.slice(-6)}`;

  return (
    <Pressable
      onPress={handleCopy}
      className="bg-bg-card border border-neutral-800 rounded-xl p-4 active:opacity-80"
    >
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center gap-2">
          <View
            style={{ backgroundColor: wallet.color }}
            className="w-7 h-7 rounded-full items-center justify-center"
          >
            <Text className="text-white text-xs font-bold">
              {wallet.symbol.charAt(0)}
            </Text>
          </View>
          <Text className="text-text-primary font-semibold">{wallet.label}</Text>
          <Text className="text-text-muted text-sm">({wallet.symbol})</Text>
        </View>
        <Text className={`text-sm font-semibold ${copied ? 'text-green-400' : 'text-accent-primary'}`}>
          {copied ? 'Copied!' : 'Tap to copy'}
        </Text>
      </View>
      <Text className="text-text-secondary text-xs font-mono">{truncated}</Text>
    </Pressable>
  );
}

export function CryptoDonations() {
  return (
    <View className="gap-3">
      <Text className="text-text-secondary text-sm text-center mb-1">
        Support the project with crypto
      </Text>
      {WALLETS.map((wallet) => (
        <WalletRow key={wallet.symbol} wallet={wallet} />
      ))}
    </View>
  );
}
