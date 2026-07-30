import { Link } from 'react-router-dom';

export const Footer = () => (
  <footer className="relative z-20 border-t border-slate-200/80 bg-white/90 px-6 py-12 text-slate-500 backdrop-blur-md">
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-col justify-between gap-8 md:flex-row md:items-start">
        <div className="max-w-md">
          <Link to="/" className="mb-3 inline-flex items-center gap-2 text-slate-900 group">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-primary to-accent text-white shadow-sm">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <span className="text-lg font-extrabold tracking-tight">Nirogi<span className="text-primary">.</span></span>
          </Link>
          <p className="text-sm leading-relaxed text-slate-600">
            India-focused medicine price snapshot engine. We aggregate verified public offer data from 1mg, Netmeds, and PharmEasy to bring transparent price visibility.
          </p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:gap-12 text-sm">
          <div>
            <h4 className="mb-2.5 font-semibold text-slate-900">Navigation</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/" className="transition-colors hover:text-primary">Home</Link>
              </li>
              <li>
                <Link to="/compare" className="transition-colors hover:text-primary">Compare Medicines</Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-2.5 font-semibold text-slate-900">Pharmacies Tracked</h4>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">1mg</span>
              <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">Netmeds</span>
              <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">PharmEasy</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-10 border-t border-slate-200/60 pt-6 text-center text-xs text-slate-400 md:flex md:items-center md:justify-between md:text-left">
        <p>Nirogi is an informational tool and does not sell medicines or provide medical advice.</p>
        <p className="mt-2 md:mt-0">&copy; {new Date().getFullYear()} Nirogi. All rights reserved.</p>
      </div>
    </div>
  </footer>
);
