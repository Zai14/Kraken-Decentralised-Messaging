import React, { createContext, useContext, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Home } from './pages/Home';
import { Messages } from './pages/Messages';
import { Wallet } from './pages/Wallet';
import { Search } from './pages/Search';
import { Profile } from './pages/Profile';
import { supabase } from './lib/supabase';

interface AuthContextType {
  isAuthenticated: boolean;
  walletAddress: string | null;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  walletAddress: null,
  logout: () => {},
});

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  useEffect(() => {
    // Check for existing session
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      const address = localStorage.getItem('walletAddress');
      
      if (session && address) {
        setIsAuthenticated(true);
        setWalletAddress(address);
      } else {
        // Clear local storage if session is invalid
        localStorage.removeItem('walletAddress');
        setIsAuthenticated(false);
        setWalletAddress(null);
      }
    };

    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        const address = localStorage.getItem('walletAddress');
        if (address) {
          setIsAuthenticated(true);
          setWalletAddress(address);
        }
      } else {
        setIsAuthenticated(false);
        setWalletAddress(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('walletAddress');
    setIsAuthenticated(false);
    setWalletAddress(null);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, walletAddress, logout }}>
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={!isAuthenticated ? <Login /> : <Navigate to="/" replace />}
          />
          <Route
            path="/"
            element={isAuthenticated ? <Layout /> : <Navigate to="/login" replace />}
          >
            <Route index element={<Home />} />
            <Route path="messages" element={<Messages />} />
            <Route path="search" element={<Search />} />
            <Route path="wallet" element={<Wallet />} />
            <Route path="profile" element={<Profile />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}

export default App