import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { DemoDataBadge } from './DemoDataBadge';

export const Navbar: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { dataMode, user } = useAppContext();
  const location = useLocation();
  const navigate = useNavigate();

  const handleAnchor = (
    e: React.MouseEvent<HTMLAnchorElement>,
    hash: string
  ) => {
    setMobileOpen(false);
    if (location.pathname === '/') {
      const target = document.getElementById(hash);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      e.preventDefault();
      navigate(`/#${hash}`);
      setTimeout(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' });
      }, 80);
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/8 bg-[#101512]/90 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
        {/* Zone 1: Clean Brand wordmark + Demo mode badge */}
        <div className="flex items-center gap-3 shrink-0">
          <Link
            to="/"
            className="font-display text-lg font-extrabold tracking-tight text-[#E8F0EA] hover:text-[#A5EBC3] transition-colors whitespace-nowrap shrink-0"
          >
            BULLSIGHT
          </Link>
          {dataMode === 'demo' && <DemoDataBadge compact />}
        </div>

        {/* Zone 2: Concise single-line navigation links */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-[#91A197]"
        >
          <Link
            to="/"
            className="hover:text-[#E8F0EA] transition-colors whitespace-nowrap shrink-0"
          >
            Home
          </Link>
          <Link
            to="/app/explore"
            className="hover:text-[#E8F0EA] transition-colors whitespace-nowrap shrink-0"
          >
            Explore
          </Link>
          <a
            href="#intelligence"
            onClick={(e) => handleAnchor(e, 'intelligence')}
            className="hover:text-[#E8F0EA] transition-colors whitespace-nowrap shrink-0"
          >
            AI Intelligence
          </a>
          <a
            href="#about"
            onClick={(e) => handleAnchor(e, 'about')}
            className="hover:text-[#E8F0EA] transition-colors whitespace-nowrap shrink-0"
          >
            About
          </a>
          {!user && (
            <Link
              to="/login"
              className="hover:text-[#E8F0EA] transition-colors whitespace-nowrap shrink-0"
            >
              Login
            </Link>
          )}
        </nav>

        {/* Zone 3: Single primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <Link
            to={user ? '/app/overview' : '/register'}
            data-cursor="magnetic"
            className="hidden sm:inline-flex items-center justify-center px-4 py-2 rounded-lg bg-[#36C982] text-[#101512] text-xs font-semibold hover:bg-[#A5EBC3] transition-colors whitespace-nowrap shrink-0"
          >
            {user ? 'Dashboard' : 'Get Started'}
          </Link>

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
            className="md:hidden p-2 rounded-lg border border-white/10 bg-[#18211C] text-[#E8F0EA] min-w-[40px] min-h-[40px] flex items-center justify-center"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/8 bg-[#141C17] px-4 py-4 space-y-2">
          <Link
            to="/"
            onClick={() => setMobileOpen(false)}
            className="block py-2 text-sm text-[#E8F0EA]"
          >
            Home
          </Link>
          <Link
            to="/app/explore"
            onClick={() => setMobileOpen(false)}
            className="block py-2 text-sm text-[#E8F0EA]"
          >
            Explore
          </Link>
          <a
            href="#intelligence"
            onClick={(e) => handleAnchor(e, 'intelligence')}
            className="block py-2 text-sm text-[#E8F0EA]"
          >
            AI Intelligence
          </a>
          <a
            href="#about"
            onClick={(e) => handleAnchor(e, 'about')}
            className="block py-2 text-sm text-[#E8F0EA]"
          >
            About
          </a>
          {!user && (
            <Link
              to="/login"
              onClick={() => setMobileOpen(false)}
              className="block py-2 text-sm text-[#E8F0EA]"
            >
              Login
            </Link>
          )}
          <div className="pt-2">
            <Link
              to={user ? '/app/overview' : '/register'}
              onClick={() => setMobileOpen(false)}
              className="block w-full text-center px-4 py-2.5 rounded-lg bg-[#36C982] text-[#101512] text-sm font-semibold"
            >
              {user ? 'Dashboard' : 'Get Started'}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};
