import React, { useEffect, useState } from 'react';
import { BrowserProvider } from 'ethers';

export function WalletConnect() {
  const [account, setAccount] = useState<string>('');
  const [provider, setProvider] = useState<BrowserProvider | null>(null);

  useEffect(() => {
    if (window.ethereum) {
      const provider = new BrowserProvider(window.ethereum);
      setProvider(provider);
    }
  }, []);

  const connectWallet = async () => {
    if (provider) {
      try {
        const accounts = await provider.send('eth_requestAccounts', []);
        setAccount(accounts[0]);
      } catch (error) {
        console.error('Error connecting wallet:', error);
      }
    }
  };

  return (
    <div className="p-4">
      {!account ? (
        <button
          onClick={connectWallet}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          Connect MetaMask
        </button>
      ) : (
        <div className="text-white">
          <p>Connected: {account.slice(0, 6)}...{account.slice(-4)}</p>
        </div>
      )}
    </div>
  );
}