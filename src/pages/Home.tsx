import React from 'react';
import { MessageCircle, Wallet, Anchor, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../App';

export function Home() {
  const { walletAddress } = useContext(AuthContext);

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <div className="max-w-xl mx-auto space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-4 py-12">
          <Anchor className="w-16 h-16 mx-auto text-white" />
          <h1 className="text-4xl font-bold">Kraken</h1>
          <p className="text-gray-400 max-w-md mx-auto">
            Secure, decentralized messaging powered by Ethereum.
            Connect your wallet to start sending encrypted messages.
          </p>
        </div>

        {/* Wallet Status */}
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium mb-1">Wallet Status</h2>
              {walletAddress ? (
                <p className="text-gray-400">
                  Connected: {`${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`}
                </p>
              ) : (
                <p className="text-red-400">Not connected</p>
              )}
            </div>
            <Wallet className="w-6 h-6 text-gray-400" />
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link to="/messages" className="group">
            <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 hover:border-white/20 transition-all">
              <MessageCircle className="w-8 h-8 mb-4 text-white" />
              <h2 className="text-lg font-medium mb-2">Send Message</h2>
              <p className="text-gray-400 text-sm">
                Start a secure conversation with any Ethereum address
              </p>
            </div>
          </Link>

          <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
            <Shield className="w-8 h-8 mb-4 text-white" />
            <h2 className="text-lg font-medium mb-2">Security</h2>
            <p className="text-gray-400 text-sm">
              End-to-end encrypted messages signed with your wallet
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}