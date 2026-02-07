import { useState, useCallback } from 'react';
import { Platform, View, Text, Pressable } from 'react-native';
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
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [wallet.address]);

  const truncated = `${wallet.address.slice(0, 8)}...${wallet.address.slice(-6)}`;

  return (
    <Pressable onPress={handleCopy} className="active:opacity-80">
      <View
        style={{ backgroundColor: copied ? '#22c55e' : wallet.color }}
        className="w-6 h-6 rounded-full items-center justify-center"
      >
        <Text className="text-white text-[9px] font-bold">
          {copied ? '\u2713' : wallet.symbol}
        </Text>
      </View>
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
