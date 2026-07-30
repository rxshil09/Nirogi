import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SearchIcon = () => (
  <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
  </svg>
);

const ClockIcon = () => (
  <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m5-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
);

const ShieldCheckIcon = () => (
  <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
  </svg>
);

const LayersIcon = () => (
  <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L12 7.5l5.571 2.25M6.429 14.25L2.25 16.5l9.75 5.25 9.75-5.25-4.179-2.25m-11.142 0L12 16.5l5.571-2.25" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
  </svg>
);

const SAMPLE_DEMOS = [
  {
    id: 'dolo-650',
    name: 'Dolo 650mg Tablet',
    variant: '15 Tablets in 1 Strip',
    company: 'Micro Labs Ltd',
    offers: [
      { retailer: 'PharmEasy', price: '₹27.10', mrp: '₹34.00', savings: '20% OFF', best: true, status: 'In Stock' },
      { retailer: 'Netmeds', price: '₹28.40', mrp: '₹34.00', savings: '16% OFF', best: false, status: 'In Stock' },
      { retailer: '1mg', price: '₹30.50', mrp: '₹34.00', savings: '10% OFF', best: false, status: 'In Stock' },
    ],
  },
  {
    id: 'pan-40',
    name: 'Pan 40mg Tablet',
    variant: '15 Tablets in 1 Strip',
    company: 'Alkem Laboratories',
    offers: [
      { retailer: '1mg', price: '₹131.20', mrp: '₹155.00', savings: '15% OFF', best: true, status: 'In Stock' },
      { retailer: 'PharmEasy', price: '₹134.50', mrp: '₹155.00', savings: '13% OFF', best: false, status: 'In Stock' },
      { retailer: 'Netmeds', price: '₹139.00', mrp: '₹155.00', savings: '10% OFF', best: false, status: 'In Stock' },
    ],
  },
  {
    id: 'augmentin-625',
    name: 'Augmentin 625 Duo Tablet',
    variant: '10 Tablets in 1 Strip',
    company: 'GlaxoSmithKline',
    offers: [
      { retailer: 'Netmeds', price: '₹182.00', mrp: '₹223.40', savings: '18% OFF', best: true, status: 'In Stock' },
      { retailer: 'PharmEasy', price: '₹189.50', mrp: '₹223.40', savings: '15% OFF', best: false, status: 'In Stock' },
      { retailer: '1mg', price: '₹195.00', mrp: '₹223.40', savings: '12% OFF', best: false, status: 'In Stock' },
    ],
  },
];

export const HomePage = () => {
  const [query, setQuery] = useState('');
  const [activeDemo, setActiveDemo] = useState(0);
  const navigate = useNavigate();

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = query.trim();
    navigate(trimmed ? `/compare?q=${encodeURIComponent(trimmed)}` : '/compare');
  };

  const selectedDemo = (SAMPLE_DEMOS[activeDemo] ?? SAMPLE_DEMOS[0])!;

  return (
    <div className="relative z-10 space-y-24 pb-20">
      {/* Hero Section */}
      <section className="relative pt-16 pb-12 md:pt-20 md:pb-16 text-center">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          {/* Main Title */}
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-6xl md:text-7xl leading-[1.15]">
            Compare medicine prices across India's top pharmacies{' '}
            <span className="bg-gradient-to-r from-primary via-accent to-rose-600 bg-clip-text text-transparent">
              in real-time
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-lg text-slate-600 sm:text-xl md:text-2xl max-w-2xl mx-auto leading-relaxed">
            Search medicine offers, verify exact pack variants, and see precise collection timestamps from 1mg, Netmeds, and PharmEasy.
          </p>

          {/* Search Box */}
          <div className="mt-10 mx-auto max-w-2xl">
            <form onSubmit={handleSearch} className="relative group">
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-primary/30 via-accent/30 to-rose-400/30 opacity-75 blur-lg transition duration-500 group-hover:opacity-100" />
              <div className="relative flex items-center rounded-2xl border border-slate-200 bg-white p-2 shadow-xl backdrop-blur-xl">
                <div className="pl-3 sm:pl-4 pr-2 shrink-0">
                  <SearchIcon />
                </div>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search medicine (e.g. Dolo 650, Pan 40)..."
                  className="w-full bg-transparent py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none text-sm sm:text-base font-medium truncate"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="p-2 text-slate-400 hover:text-slate-600 transition-colors mr-1 shrink-0"
                    aria-label="Clear query"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                ) : null}
                <button
                  type="submit"
                  className="btn-primary flex items-center gap-2 text-sm sm:text-base font-semibold px-5 sm:px-6 py-3 rounded-xl shadow-md whitespace-nowrap shrink-0"
                >
                  <span>Compare Prices</span>
                  <ArrowRightIcon />
                </button>
              </div>
            </form>
            <p className="mt-3 text-xs text-slate-500">
              Instant aggregation across verified pharmacy catalog sources. Zero sponsored ranking bias.
            </p>
          </div>
        </div>
      </section>

      {/* Supported Pharmacies Strip */}
      <section className="mx-auto max-w-6xl px-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white/70 py-6 px-8 shadow-sm backdrop-blur-md">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="text-center sm:text-left">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Pharmacies Tracked</p>
              <p className="text-sm font-semibold text-slate-700">Live price & stock snapshots</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="font-bold text-slate-800 text-lg">1mg</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="font-bold text-slate-800 text-lg">Netmeds</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="font-bold text-slate-800 text-lg">PharmEasy</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Sample Price Comparison Preview Card (Interactive Demo) */}
      <section className="mx-auto max-w-5xl px-4">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            See how price comparison works
          </h2>
          <p className="mt-2 text-slate-600 text-sm sm:text-base">
            Select a sample medicine below to preview how Nirogi presents side-by-side offer comparisons.
          </p>
          
          {/* Demo selector tabs */}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {SAMPLE_DEMOS.map((demo, idx) => (
              <button
                key={demo.id}
                type="button"
                onClick={() => setActiveDemo(idx)}
                className={`rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition-all ${
                  activeDemo === idx
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'bg-white/80 border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {demo.name}
              </button>
            ))}
          </div>
        </div>

        {/* Preview Card */}
        <div className="glass-card p-6 sm:p-8 shadow-xl border-slate-200/90 relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200/80 pb-6 mb-6 gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-md bg-amber-50 border border-amber-200/80 px-2.5 py-1 text-xs font-semibold text-amber-800 mb-2">
                Sample Preview (Mock Data)
              </div>
              <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900">{selectedDemo.name}</h3>
              <p className="text-sm text-slate-500 mt-1">
                {selectedDemo.variant} • <span className="font-medium text-slate-700">{selectedDemo.company}</span>
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 self-start md:self-auto">
              <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Demonstration Mock Snapshot</span>
            </div>
          </div>

          {/* Offers list */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {selectedDemo.offers.map((offer) => (
              <div
                key={offer.retailer}
                className={`rounded-xl p-5 transition-all border ${
                  offer.best
                    ? 'bg-emerald-50/50 border-emerald-300 ring-2 ring-emerald-500/20 shadow-md'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-slate-900 text-lg">{offer.retailer}</span>
                  {offer.best ? (
                    <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[11px] font-bold text-white uppercase tracking-wider">
                      Lowest Price
                    </span>
                  ) : null}
                </div>

                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-2xl font-extrabold text-slate-900">{offer.price}</span>
                  <span className="text-xs text-slate-400 line-through">{offer.mrp}</span>
                </div>

                <div className="flex items-center justify-between text-xs font-medium pt-2 border-t border-slate-100">
                  <span className="text-emerald-700 font-semibold">{offer.savings}</span>
                  <span className="text-slate-500">{offer.status}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <span>Sample mock prices for demonstration. Search above to compare live prices.</span>
            <button
              type="button"
              onClick={() => navigate(`/compare?q=${encodeURIComponent(selectedDemo.name)}`)}
              className="text-primary font-bold hover:underline inline-flex items-center gap-1"
            >
              Run live comparison for this medicine &rarr;
            </button>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            How Nirogi works in 3 simple steps
          </h2>
          <p className="mt-3 text-slate-600 text-base max-w-xl mx-auto">
            Get transparent medicine pricing with full disclosure of sources, pack sizes, and timestamp freshness.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Step 1 */}
          <div className="glass-card-hover p-8 relative flex flex-col items-start">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-100 text-primary font-bold text-xl">
              1
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Search Medicine Name</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Type the brand name or generic formulation along with your optional city pincode for local price availability.
            </p>
          </div>

          {/* Step 2 */}
          <div className="glass-card-hover p-8 relative flex flex-col items-start">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-100 text-primary font-bold text-xl">
              2
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Real-Time Scraping</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Our backend engines query 1mg, Netmeds, and PharmEasy simultaneously to fetch current listed prices and stock status.
            </p>
          </div>

          {/* Step 3 */}
          <div className="glass-card-hover p-8 relative flex flex-col items-start">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-100 text-primary font-bold text-xl">
              3
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Compare & Choose</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Review side-by-side offer cards, check timestamp collection details, and navigate directly to the pharmacy offer.
            </p>
          </div>
        </div>
      </section>

      {/* Core Feature Highlights */}
      <section className="mx-auto max-w-6xl px-4">
        <div className="rounded-3xl bg-slate-900 text-white p-8 sm:p-12 shadow-2xl relative overflow-hidden">
          <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
          
          <div className="relative z-10 max-w-3xl mb-12">
            <h2 className="text-3xl font-extrabold sm:text-4xl text-white">
              Built on transparency, not sponsored ads
            </h2>
            <p className="mt-4 text-slate-300 text-base sm:text-lg">
              Unlike traditional listing sites, Nirogi does not manipulate search order for commission fees. We prioritize exact medicine data clarity.
            </p>
          </div>

          <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="rounded-2xl border border-slate-800 bg-slate-800/60 p-6 backdrop-blur-md">
              <div className="mb-4 inline-flex p-3 rounded-xl bg-rose-500/20 text-rose-400">
                <ClockIcon />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Timestamp Transparency</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Every single offer displays the exact collection timestamp so you know when the price was verified.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-800/60 p-6 backdrop-blur-md">
              <div className="mb-4 inline-flex p-3 rounded-xl bg-rose-500/20 text-rose-400">
                <LayersIcon />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Exact Pack Matching</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                We clearly display strip count, tablet strength, and dosage form to prevent misleading unit price comparisons.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-800/60 p-6 backdrop-blur-md">
              <div className="mb-4 inline-flex p-3 rounded-xl bg-rose-500/20 text-rose-400">
                <ShieldCheckIcon />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Direct Source Links</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Jump directly to the retailer's official product page to complete your purchase securely.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom Search CTA Section */}
      <section className="mx-auto max-w-4xl px-4 text-center">
        <div className="glass-card p-10 sm:p-14 shadow-xl border-rose-100 relative overflow-hidden">
          <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-rose-400/10 blur-2xl" />
          <div className="relative z-10 max-w-xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Ready to compare medicine prices?
            </h2>
            <p className="mt-3 text-slate-600 text-sm sm:text-base">
              Enter any medicine name to find live price snapshots across 1mg, Netmeds, and PharmEasy.
            </p>

            <form onSubmit={handleSearch} className="mt-8 flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Medicine name (e.g., Dolo 650)..."
                className="input-field py-3 text-base flex-1"
              />
              <button type="submit" className="btn-primary whitespace-nowrap py-3 px-6">
                Start Search
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
};
