import { Link } from 'react-router-dom';

export const Footer = () => (
  <footer className="relative z-10 border-t border-border bg-background/90 px-6 py-8 text-textSecondary backdrop-blur">
    <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 text-center md:flex-row md:text-left">
      <div>
        <Link to="/" className="mb-2 inline-flex items-center gap-2 text-text">
          <img src="/logo.svg" alt="Nirogi" className="h-6 w-6" />
          <span className="text-lg font-bold">Nirogi</span>
        </Link>
        <p className="max-w-md text-sm leading-relaxed">
          Transparent medicine price snapshots for India. Prices, stock, and delivery can change at the retailer.
        </p>
      </div>
      <div className="text-sm md:text-right">
        <Link to="/compare" className="font-medium transition-colors hover:text-primary">
          Compare medicines
        </Link>
        <p className="mt-3">Nirogi is not a pharmacy and does not provide medical advice.</p>
      </div>
    </div>
  </footer>
);
