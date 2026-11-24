import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Brain, Home, Grid3X3, BarChart3, User, Sun, Moon } from 'lucide-react';
import { useAppStore } from '../store/app';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const darkMode = useAppStore((s) => s.darkMode);
  const toggleDarkMode = useAppStore((s) => s.toggleDarkMode);
  const isGamePage = location.pathname.startsWith('/game/');

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
                <Brain className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <span className="text-base sm:text-xl font-bold bg-gradient-to-r from-primary-600 to-accent-600 dark:from-primary-400 dark:to-accent-400 bg-clip-text text-transparent">
                CognitivePulse
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              <NavLink to="/" active={isActive('/')} icon={<Home className="w-4 h-4" />} label="Home" />
              <NavLink to="/games" active={isActive('/games')} icon={<Grid3X3 className="w-4 h-4" />} label="Games" />
              <NavLink to="/stats" active={isActive('/stats')} icon={<BarChart3 className="w-4 h-4" />} label="Progress" />
              <NavLink to="/profile" active={isActive('/profile')} icon={<User className="w-4 h-4" />} label="Profile" />
            </nav>

            {/* Theme Toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Toggle dark mode"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={`flex-1 max-w-6xl w-full mx-auto ${isGamePage ? '' : 'px-4 sm:px-6 lg:px-8'} py-4 sm:py-6`}>
        {children}
      </main>

      {/* Mobile Bottom Navigation — hidden during gameplay */}
      {!isGamePage && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 z-50 pb-safe">
          <div className="flex items-center justify-around h-14 sm:h-16">
            <MobileNavLink to="/" active={isActive('/')} icon={<Home className="w-5 h-5" />} label="Home" />
            <MobileNavLink to="/games" active={isActive('/games')} icon={<Grid3X3 className="w-5 h-5" />} label="Games" />
            <MobileNavLink to="/stats" active={isActive('/stats')} icon={<BarChart3 className="w-5 h-5" />} label="Progress" />
            <MobileNavLink to="/profile" active={isActive('/profile')} icon={<User className="w-5 h-5" />} label="Profile" />
          </div>
        </nav>
      )}
    </div>
  );
}

function NavLink({ to, active, icon, label }: { to: string; active: boolean; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}

function MobileNavLink({ to, active, icon, label }: { to: string; active: boolean; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className={`flex flex-col items-center gap-0.5 p-2 rounded-lg transition-colors min-w-12 ${
        active ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400'
      }`}
    >
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </Link>
  );
}
