import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const SearchIcon = () => (
  <svg className="h-8 w-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
  </svg>
);

const SourceIcon = () => (
  <svg className="h-8 w-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 2m5-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
);

const MatchIcon = () => (
  <svg className="h-8 w-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m9 12 2 2 4-4m6.618-4.016A11.955 11.955 0 0 0 12 2.944 11.955 11.955 0 0 0 .382 8.984 11.955 11.955 0 0 0 12 21.016 11.955 11.955 0 0 0 23.618 8.984Z" />
  </svg>
);

const featureCards = [
  { icon: <SearchIcon />, title: 'Search medicine offers', description: 'Start with a medicine name and see collected source offers in one place.' },
  { icon: <SourceIcon />, title: 'Know when a price was checked', description: 'Every offer is shown with its source and a clear collection timestamp.' },
  { icon: <MatchIcon />, title: 'Compare exact variants carefully', description: 'Pack size, strength, and dosage form stay visible instead of being guessed.' },
];

export const HomePage = () => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const startSearch = () => {
    const trimmed = query.trim();
    navigate(trimmed ? `/compare?q=${encodeURIComponent(trimmed)}` : '/compare');
  };

  return (
    <div className="relative z-10">
      <section className="relative flex min-h-[calc(100vh-64px)] items-center justify-center overflow-hidden px-4 py-16 text-center">
        <div className="relative z-10 mx-auto max-w-4xl">
          <p className="mb-5 text-sm font-semibold uppercase tracking-[0.2em] text-primary">India-focused medicine comparison</p>
          <h1 className="mb-6 text-5xl font-extrabold leading-tight text-text md:text-7xl">
            Find medicine price <span className="bg-gradient-to-r from-primary to-error bg-clip-text text-transparent">snapshots</span>
          </h1>
          <p className="mb-10 text-xl text-textSecondary md:text-2xl">
            Search medicine offers, check the exact pack, and see when each source was last collected.
          </p>

          <div className="mx-auto mb-8 max-w-xl">
            <label className="sr-only" htmlFor="medicine-query">Medicine name</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2"><SearchIcon /></span>
              <input
                id="medicine-query"
                type="search"
                placeholder="Search for a medicine, e.g. Dolo 650 tablet"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && startSearch()}
                className="w-full rounded-xl border border-border bg-surface/90 py-4 pl-14 pr-28 text-text shadow-lg placeholder:text-textSecondary"
              />
              <button type="button" onClick={startSearch} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-primary px-4 py-2 font-semibold text-white transition-colors hover:bg-error">
                Compare
              </button>
            </div>
          </div>

          <Link to="/compare" className="btn-secondary">Open comparison</Link>
        </div>
        <div className="absolute left-1/4 top-1/4 h-24 w-24 rounded-full bg-primary/10 blur-xl" />
        <div className="absolute bottom-1/3 right-1/4 h-32 w-32 rounded-full bg-accent/40 blur-xl" />
      </section>

      <section className="bg-surface/70 px-4 py-20 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl text-center">
          <h2 className="mb-12 text-4xl font-bold text-text">Built around transparent comparisons</h2>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {featureCards.map((card) => (
              <article key={card.title} className="card flex flex-col items-center p-8 text-center">
                <div className="mb-6 rounded-full border border-border bg-background p-4 shadow-inner-glow">{card.icon}</div>
                <h3 className="mb-3 text-xl font-semibold text-text">{card.title}</h3>
                <p className="text-textSecondary">{card.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
