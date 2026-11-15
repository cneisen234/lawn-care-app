// Andy's Lawn Care's footer, kept as it was: the deep green-black "ground" with
// moss + tan glows, the brand mark and wordmark, a blurb and a hand-lettered
// line. Its Explore and Get in Touch columns come back with the marketing pages
// and contact details (plan.md Step 20); nothing here points at a page that
// doesn't exist yet.

import { cacheLife } from 'next/cache';
import Logo from './Logo';
import { site } from '@/lib/site';

// The copyright year. With Cache Components on (next.config.ts), reading the
// clock during prerender is refused unless it's cached; the year only changes
// once a year, so it's cached and refreshed daily (Next 16 docs: Caching →
// "Random values and timestamps").
async function CopyrightYear() {
  'use cache';
  cacheLife('days');
  return <>{new Date().getFullYear()}</>;
}

export default function Footer() {
  return (
    <footer
      className="relative overflow-hidden mt-auto"
      style={{ backgroundColor: 'var(--ink)', borderTop: '1px solid rgba(138, 154, 91, 0.22)' }}
    >
      {/* Ambient glows echoing the mobile menu */}
      <div
        className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full opacity-15 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, var(--moss) 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
      />
      <div
        className="absolute bottom-0 left-0 w-[420px] h-[420px] rounded-full opacity-12 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, var(--tan) 0%, transparent 70%)', transform: 'translate(-30%, 30%)' }}
      />

      <div className="container mx-auto px-4 py-16 relative">
        <div className="mb-12 max-w-md">
          <div className="flex items-center gap-3 mb-4">
            <Logo size={52} />
            <div className="leading-tight">
              <span className="block text-2xl font-bold" style={{ color: 'var(--bone)', fontFamily: 'var(--font-zilla)' }}>
                {site.name}
              </span>
              <span
                className="block text-[0.68rem] font-bold uppercase tracking-[0.2em]"
                style={{ color: 'var(--moss)' }}
              >
                For solo lawn pros
              </span>
            </div>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--bone)', opacity: 0.78 }}>
            {site.blurb}
          </p>
          <p className="mt-5 font-hand text-3xl" style={{ color: 'var(--tan)' }}>
            Done on the job, not after it
          </p>
        </div>

        <div
          className="pt-8 border-t text-center text-sm flex flex-col sm:flex-row sm:justify-between items-center gap-2"
          style={{ borderColor: 'rgba(239, 235, 224, 0.16)', color: 'var(--bone)', opacity: 0.72 }}
        >
          <p>&copy; <CopyrightYear /> {site.name}.</p>
          <p className="text-xs">Powered by Pilot Light</p>
        </div>
      </div>
    </footer>
  );
}
