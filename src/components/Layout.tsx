import React, { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { 
  Home, 
  MessageSquare, 
  Wallet, 
  LogOut,
  Anchor,
  User,
  X
} from 'lucide-react';
import { useContext } from 'react';
import { AuthContext } from '../App';

export function Layout() {
  const location = useLocation();
  const { logout, walletAddress } = useContext(AuthContext);
  const navigate = useNavigate();
  const [showProfileModal, setShowProfileModal] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleProfileClick = () => {
    setShowProfileModal(true);
  };

  const closeProfileModal = () => {
    setShowProfileModal(false);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-zinc-900 border-b border-zinc-800 z-50 flex items-center justify-between px-4">
        <div className="flex items-center space-x-2">
          <Anchor className="w-6 h-6" />
          <h1 className="text-xl font-bold">Kraken</h1>
        </div>
      </div>

      {/* Desktop sidebar */}
      <nav className="fixed left-0 top-0 h-full w-16 md:w-64 bg-zinc-900 border-r border-zinc-800">
        <div className="p-4 hidden md:block">
          <div className="flex items-center space-x-2">
            <Anchor className="w-8 h-8" />
            <h1 className="text-2xl font-bold">Kraken</h1>
          </div>
        </div>
        <div className="space-y-1 p-2 mt-14">
          <NavItem to="/" icon={<Home />} label="Home" active={location.pathname === '/'} />
          <NavItem to="/messages" icon={<MessageSquare />} label="Messages" active={location.pathname === '/messages'} />
          <NavItem 
            to="#" 
            icon={<User />} 
            label="Profile" 
            active={false}
            onClick={handleProfileClick}
          />
          <NavItem to="/wallet" icon={<Wallet />} label="Wallet" active={location.pathname === '/wallet'} />
          
          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-2 p-3 rounded-lg hover:bg-zinc-800 transition-all text-zinc-400 hover:text-zinc-100"
          >
            <LogOut className="w-6 h-6" />
            <span className="hidden md:inline">Logout</span>
          </button>
        </div>
      </nav>

      {/* Mobile bottom navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-zinc-900 border-t border-zinc-800 flex items-center justify-around px-4">
        <Link to="/" className="p-2 text-zinc-400 hover:text-zinc-100">
          <Home className="w-6 h-6" />
        </Link>
        <Link to="/messages" className="p-2 text-zinc-400 hover:text-zinc-100">
          <MessageSquare className="w-6 h-6" />
        </Link>
        <button onClick={handleProfileClick} className="p-2 text-zinc-400 hover:text-zinc-100">
          <User className="w-6 h-6" />
        </button>
        <Link to="/wallet" className="p-2 text-zinc-400 hover:text-zinc-100">
          <Wallet className="w-6 h-6" />
        </Link>
      </div>

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-zinc-100">Profile Information</h2>
              <button
                onClick={closeProfileModal}
                className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-zinc-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-center mb-6">
                <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center">
                  <User className="w-10 h-10 text-zinc-400" />
                </div>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">
                    Wallet Address
                  </label>
                  <div className="bg-zinc-800 rounded-lg p-3 border border-zinc-700">
                    <p className="text-zinc-100 font-mono text-sm break-all">
                      {walletAddress || 'Not connected'}
                    </p>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">
                    Account Type
                  </label>
                  <div className="bg-zinc-800 rounded-lg p-3 border border-zinc-700">
                    <p className="text-zinc-100 text-sm">
                      {localStorage.getItem('authType') === 'email' ? 'Email Account' : 'Wallet Account'}
                    </p>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">
                    User ID
                  </label>
                  <div className="bg-zinc-800 rounded-lg p-3 border border-zinc-700">
                    <p className="text-zinc-100 font-mono text-sm">
                      {walletAddress ? `${walletAddress.slice(0, 10)}...${walletAddress.slice(-8)}` : 'N/A'}
                    </p>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">
                    Status
                  </label>
                  <div className="bg-zinc-800 rounded-lg p-3 border border-zinc-700">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-zinc-100 text-sm">
                        {localStorage.getItem('authType') === 'email' ? 'Email Verified' : 'Wallet Connected'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="pt-4 border-t border-zinc-800">
                <button
                  onClick={() => {
                    if (walletAddress) {
                      navigator.clipboard.writeText(walletAddress);
                      // You could add a toast notification here
                    }
                  }}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg transition-colors"
                >
                  Copy {localStorage.getItem('authType') === 'email' ? 'User ID' : 'Wallet Address'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="ml-16 md:ml-64 mt-14 md:mt-0 mb-16 md:mb-0 bg-zinc-950">
        <Outlet />
      </main>
    </div>
  );
}

function NavItem({ 
  to, 
  icon, 
  label, 
  active, 
  onClick 
}: { 
  to: string; 
  icon: React.ReactNode; 
  label: string; 
  active: boolean;
  onClick?: () => void;
}) {
  const content = (
    <div
      className={`flex items-center space-x-3 p-3 rounded-lg transition-all ${
        active 
          ? 'text-zinc-100 bg-zinc-800' 
          : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
      }`}
    >
      <span className="w-6 h-6">{icon}</span>
      <span className="hidden md:inline">{label}</span>
    </div>
  );

  if (onClick) {
    return (
      <button onClick={onClick} className="w-full text-left">
        {content}
      </button>
    );
  }

  return (
    <Link to={to}>
      {content}
    </Link>
  );
}