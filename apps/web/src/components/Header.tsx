import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

export const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  const closeMenu = () => setMenuOpen(false);
  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/80 backdrop-blur-md transition-all duration-300">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2.5 group" onClick={closeMenu}>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-accent shadow-md shadow-primary/20 transition-transform group-hover:scale-105">
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <span className="text-xl font-extrabold tracking-tight text-slate-900">
            Nirogi<span className="text-primary">.</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1.5 md:flex" aria-label="Primary navigation">
          <Link
            to="/"
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              isActive('/')
                ? 'bg-rose-50 text-primary font-semibold'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            Home
          </Link>
          <Link
            to="/compare"
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              isActive('/compare')
                ? 'bg-rose-50 text-primary font-semibold'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            Compare Medicines
          </Link>
          <Link
            to="/metrics"
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              isActive('/metrics')
                ? 'bg-rose-50 text-primary font-semibold'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            System Metrics
          </Link>
        </nav>

        <button
          type="button"
          className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 md:hidden"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {menuOpen ? (
        <nav className="border-t border-slate-200 bg-white/95 px-4 py-3 shadow-lg md:hidden" aria-label="Mobile navigation">
          <div className="mx-auto flex max-w-7xl flex-col gap-1.5">
            <Link
              to="/"
              className={`rounded-lg px-3.5 py-2.5 text-base font-medium transition-colors ${
                isActive('/') ? 'bg-rose-50 text-primary font-semibold' : 'text-slate-700 hover:bg-slate-50'
              }`}
              onClick={closeMenu}
            >
              Home
            </Link>
            <Link
              to="/compare"
              className={`rounded-lg px-3.5 py-2.5 text-base font-medium transition-colors ${
                isActive('/compare') ? 'bg-rose-50 text-primary font-semibold' : 'text-slate-700 hover:bg-slate-50'
              }`}
              onClick={closeMenu}
            >
              Compare Medicines
            </Link>
            <Link
              to="/metrics"
              className={`flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-base font-medium transition-colors ${
                isActive('/metrics') ? 'bg-rose-50 text-primary font-semibold' : 'text-slate-700 hover:bg-slate-50'
              }`}
              onClick={closeMenu}
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              System Metrics
            </Link>
          </div>
        </nav>
      ) : null}
    </header>
  );
};
