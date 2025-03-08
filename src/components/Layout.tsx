import React from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { 
  Home, 
  MessageSquare, 
  Search, 
  Wallet, 
  LogOut,
  Anchor
} from 'lucide-react';
import { useContext } from 'react';
import { AuthContext } from '../App';

export function Layout() {
  const location = useLocation();
  const { logout, walletAddress } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
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
          <NavItem to="/search" icon={<Search />} label="Search" active={location.pathname === '/search'} />
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
        <Link to="/search" className="p-2 text-zinc-400 hover:text-zinc-100">
          <Search className="w-6 h-6" />
        </Link>
        <Link to="/wallet" className="p-2 text-zinc-400 hover:text-zinc-100">
          <Wallet className="w-6 h-6" />
        </Link>
      </div>

      {/* Main content */}
      <main className="ml-16 md:ml-64 mt-14 md:mt-0 mb-16 md:mb-0 bg-zinc-950">
        <Outlet />
      </main>
    </div>
  );
}

function NavItem({ to, icon, label, active }: { to: string; icon: React.ReactNode; label: string; active: boolean }) {
  return (
    <Link
      to={to}
      className={`flex items-center space-x-3 p-3 rounded-lg transition-all ${
        active 
          ? 'text-zinc-100 bg-zinc-800' 
          : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
      }`}
    >
      <span className="w-6 h-6">{icon}</span>
      <span className="hidden md:inline">{label}</span>
    </Link>
  );
}