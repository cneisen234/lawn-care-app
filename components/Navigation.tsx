'use client';

// Andy's Lawn Care's navigation, kept as it was: a sticky cream bar that blurs
// once the page scrolls, the brand mark + wordmark, links with an active dot,
// and a full-screen forest menu on phones. Its links and call to action come
// from lib/site.ts: until the marketing pages exist (plan.md Step 20) there are
// none, so only the brand shows and no menu button appears.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import Logo from './Logo';
import { navLinks, site } from '@/lib/site';

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const hasMenu = navLinks.length > 0;

  // Subtle backdrop blur once the page is scrolled
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Lock body scroll while the full-screen menu is open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <>
      <nav
        className="sticky top-0 z-50 transition-all"
        style={{
          backgroundColor: scrolled ? 'rgba(241, 237, 225, 0.88)' : 'var(--cream)',
          backdropFilter: scrolled ? 'blur(12px)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(12px)' : 'none',
          borderBottom: `1px solid ${scrolled ? 'rgba(43, 74, 52, 0.14)' : 'transparent'}`,
        }}
      >
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-18 py-2.5">
            {/* Brand — mark + wordmark */}
            <Link
              href="/"
              className="flex items-center gap-2.5 group"
              onClick={() => setIsOpen(false)}
            >
              <span className="transition-transform group-hover:-rotate-6">
                <Logo size={44} />
              </span>
              <span className="flex flex-col leading-none">
                <span
                  className="text-lg md:text-xl font-bold tracking-tight"
                  style={{ color: 'var(--forest)', fontFamily: 'var(--font-zilla)' }}
                >
                  {site.name}
                </span>
                <span
                  className="text-[0.7rem] font-semibold uppercase tracking-[0.18em]"
                  style={{ color: 'var(--tan-deep)' }}
                >
                  For solo lawn pros
                </span>
              </span>
            </Link>

            {/* Desktop links */}
            {hasMenu && (
              <ul className="hidden md:flex items-center gap-1" style={{ fontFamily: 'var(--font-zilla)' }}>
                {navLinks.map((l) => {
                  const active = pathname === l.href;
                  return (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        className="relative px-4 py-2 text-sm font-semibold transition-colors hover:opacity-70"
                        style={{ color: active ? 'var(--moss-deep)' : 'var(--forest)' }}
                      >
                        {l.label}
                        <span
                          className="absolute left-1/2 -translate-x-1/2 bottom-0.5 w-1.5 h-1.5 rounded-full transition-opacity"
                          style={{ backgroundColor: 'var(--moss-deep)', opacity: active ? 1 : 0 }}
                        />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Hamburger — mobile */}
            {hasMenu && (
              <button
                className="md:hidden relative w-10 h-10 flex items-center justify-center rounded-full transition-colors"
                style={{ backgroundColor: isOpen ? 'var(--forest)' : 'rgba(43, 74, 52, 0.1)' }}
                onClick={() => setIsOpen(!isOpen)}
                aria-label={isOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={isOpen}
              >
                <div className="relative w-5 h-4 flex flex-col justify-between">
                  <span
                    className="block h-0.5 w-full transition-all origin-center rounded-full"
                    style={{
                      backgroundColor: isOpen ? 'var(--bone)' : 'var(--forest)',
                      transform: isOpen ? 'rotate(45deg) translate(4px, 5px)' : 'none',
                    }}
                  />
                  <span
                    className="block h-0.5 w-full transition-all rounded-full"
                    style={{ backgroundColor: isOpen ? 'var(--bone)' : 'var(--forest)', opacity: isOpen ? 0 : 1 }}
                  />
                  <span
                    className="block h-0.5 w-full transition-all origin-center rounded-full"
                    style={{
                      backgroundColor: isOpen ? 'var(--bone)' : 'var(--forest)',
                      transform: isOpen ? 'rotate(-45deg) translate(4px, -5px)' : 'none',
                    }}
                  />
                </div>
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Full-screen mobile overlay */}
      {hasMenu && (
        <div
          className={`md:hidden fixed inset-0 z-40 transition-all duration-300 ${
            isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          style={{ backgroundColor: 'var(--forest-deep)' }}
        >
          {/* Ambient moss + tan glow */}
          <div
            className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full opacity-25 blur-3xl pointer-events-none"
            style={{ background: 'radial-gradient(circle, var(--moss) 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
          />
          <div
            className="absolute bottom-0 left-0 w-[420px] h-[420px] rounded-full opacity-20 blur-3xl pointer-events-none"
            style={{ background: 'radial-gradient(circle, var(--tan) 0%, transparent 70%)', transform: 'translate(-30%, 30%)' }}
          />

          <div className="relative h-full flex flex-col pt-24 pb-10 px-8">
            <nav className="flex-1 flex flex-col justify-center">
              <ul className="space-y-1">
                {navLinks.map((l, idx) => {
                  const active = pathname === l.href;
                  return (
                    <li key={l.href} className={isOpen ? 'fade-in-up' : ''} style={{ animationDelay: `${idx * 60}ms` }}>
                      <Link href={l.href} onClick={() => setIsOpen(false)} className="group flex items-baseline py-2.5">
                        <span
                          className="text-4xl font-bold tracking-tight transition-colors"
                          style={{
                            fontFamily: 'var(--font-zilla)',
                            color: active ? 'var(--moss)' : 'var(--bone)',
                          }}
                        >
                          {l.label}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
