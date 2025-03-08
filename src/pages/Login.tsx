import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet as WalletIcon, Loader2, Anchor, Mail, Clock } from 'lucide-react';
import { BrowserProvider } from 'ethers';
import { supabase } from '../lib/supabase';

export function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const createProfile = async (address: string) => {
    try {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('address')
        .eq('address', address)
        .single();

      if (!existingProfile) {
        await supabase
          .from('profiles')
          .insert({
            address,
            username: `User_${address.slice(2, 8)}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
      }
    } catch (error) {
      console.error('Error creating profile:', error);
    }
  };

  const connectMetamask = async () => {
    setError('');
    setLoading(true);

    try {
      if (!window.ethereum) {
        throw new Error('MetaMask is not installed. Please install MetaMask to continue.');
      }

      const provider = new BrowserProvider(window.ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      
      if (!accounts[0]) {
        throw new Error('Please select a wallet address in MetaMask.');
      }

      const address = accounts[0].toLowerCase();
      const email = `${address}@kraken.web3`;
      const password = `kraken_${address}_${Date.now()}`;

      // Try to sign up first
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      // If user exists, try to sign in
      if (signUpError && signUpError.message === 'User already registered') {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password: `kraken_${address}_default`,
        });

        if (signInError) {
          // If both signup and signin fail, create a new account with new credentials
          const { data: newSignUpData, error: newSignUpError } = await supabase.auth.signUp({
            email: `${address}_${Date.now()}@kraken.web3`,
            password,
          });

          if (newSignUpError) {
            throw new Error('Failed to authenticate. Please try again.');
          }
        }
      }

      await createProfile(address);
      localStorage.setItem('walletAddress', address);
      navigate('/');

    } catch (err: any) {
      console.error('Auth error:', err);
      setError(err.message || 'Failed to authenticate. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="flex items-center justify-center mb-4">
            <Anchor className="w-12 h-12 text-zinc-100" />
          </div>
          <h1 className="text-5xl font-bold text-zinc-100 mb-2">Kraken</h1>
          <p className="text-zinc-400 mb-2">Secure Decentralized Messaging</p>
          <p className="text-sm text-zinc-500">Web3-Powered Communication</p>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-500/50 text-red-500 rounded-lg p-3 text-center">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={connectMetamask}
            disabled={loading}
            className="w-full bg-blue-500 text-white py-3 px-4 rounded-lg hover:bg-blue-600 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center space-x-2"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <WalletIcon className="w-5 h-5" />
                <span>Connect with MetaMask</span>
              </>
            )}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-800"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-zinc-950 text-zinc-500">or</span>
            </div>
          </div>

          <button
            disabled
            className="w-full bg-zinc-800/50 text-zinc-500 py-3 px-4 rounded-lg cursor-not-allowed flex items-center justify-center space-x-2 group"
          >
            <Mail className="w-5 h-5" />
            <span>Email Login</span>
            <Clock className="w-4 h-4 ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-2 py-1 bg-zinc-800 text-zinc-300 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              Coming Soon
            </span>
          </button>
        </div>

        <div className="text-center space-y-4">
          <p className="text-sm text-zinc-500">
            By connecting, you agree to our Terms of Service and Privacy Policy
          </p>
          <div className="flex justify-center space-x-4">
            <a href="#" className="text-zinc-400 hover:text-zinc-100 text-sm">Terms of Service</a>
            <a href="#" className="text-zinc-400 hover:text-zinc-100 text-sm">Privacy Policy</a>
          </div>
        </div>
      </div>
    </div>
  );
}