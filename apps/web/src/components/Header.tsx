import { useState } from 'react';
import { Link } from 'react-router-dom';

export const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="relative z-20 border-b border-border bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2" onClick={closeMenu}>
          <img src="/logo.svg" alt="Nirogi" className="h-8 w-8" />
          <span className="text-xl font-bold text-text">Nirogi</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary navigation">
          <Link to="/" className="text-sm font-medium text-textSecondary transition-colors hover:text-primary">
            Home
          </Link>
          <Link to="/compare" className="text-sm font-medium text-textSecondary transition-colors hover:text-primary">
            Compare medicines
          </Link>
        </nav>

        <button
          type="button"
          className="rounded-md p-2 text-textSecondary transition-colors hover:text-primary md:hidden"
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
        <nav className="border-t border-border bg-white px-4 py-3 md:hidden" aria-label="Mobile navigation">
          <div className="mx-auto flex max-w-7xl flex-col gap-2">
            <Link to="/" className="rounded px-3 py-2 font-medium text-textSecondary hover:bg-background hover:text-primary" onClick={closeMenu}>
              Home
            </Link>
            <Link to="/compare" className="rounded px-3 py-2 font-medium text-textSecondary hover:bg-background hover:text-primary" onClick={closeMenu}>
              Compare medicines
            </Link>
          </div>
        </nav>
      ) : null}
    </header>
  );
};
