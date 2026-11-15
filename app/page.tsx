// A branded placeholder home until the marketing site is built (plan.md
// Step 20). It shows the brand's own scenes (the hero wash with a grass line,
// a dark mown band with sign cards, the striped lawn) so the look can be judged
// now. No buttons yet: there's nowhere real for them to go.

import GrassEdge from '@/components/GrassEdge';
import MownLawn from '@/components/MownLawn';
import { site } from '@/lib/site';

const steps = [
  {
    title: 'Start the job',
    body: 'Pull up, tap Start. The clock runs while you work, so you always know what each property really takes.',
  },
  {
    title: 'Check it off',
    body: 'Mowing, trimming, edging: tick what you did. Your own prices do the math, straight onto the client’s invoice.',
  },
  {
    title: 'Review and send',
    body: 'At the end of the month your invoices are already built. Look them over, send them, done.',
  },
];

export default function Home() {
  return (
    <>
      {/* ---------------- HERO ---------------- */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(180deg, var(--forest-soft) 0%, var(--cream) 62%)', opacity: 0.75 }}
        />

        <div className="container mx-auto px-4 relative">
          <div className="max-w-3xl mx-auto text-center py-20 md:py-28">
            <div className="fade-in-up flex justify-center">
              <span className="badge">
                <span className="badge-dot" /> Coming soon
              </span>
            </div>
            <h1 className="fade-in-up stagger-1 mt-6 text-5xl md:text-7xl leading-[1.02]">
              Finish the job.
              <span className="block" style={{ color: 'var(--forest)' }}>The books are done.</span>
            </h1>
            <p className="fade-in-up stagger-2 mt-6 text-lg md:text-xl max-w-xl mx-auto" style={{ color: 'var(--ash)' }}>
              {site.blurb}
            </p>
            <p className="fade-in-up stagger-3 mt-8 flex flex-wrap items-center justify-center gap-2 text-sm font-semibold" style={{ color: 'var(--ash)' }}>
              {site.name}
              {site.namePlaceholder && <span className="placeholder-tag">Placeholder name</span>}
            </p>
            <p className="fade-in-up stagger-4 mt-6 font-hand text-3xl" style={{ color: 'var(--tan-deep)' }}>
              Built for the one-truck operation.
            </p>
          </div>
        </div>

        {/* grass line where the hero settles into the page */}
        <div className="absolute inset-x-0 bottom-0 pointer-events-none">
          <GrassEdge height={52} />
        </div>
      </section>

      {/* ---------------- HOW IT WORKS (dark mown band) ---------------- */}
      <section className="relative overflow-hidden mow-stripes-dark" style={{ backgroundColor: 'var(--forest-deep)' }}>
        <div
          className="absolute top-0 right-0 w-[440px] h-[440px] rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, var(--moss) 0%, transparent 70%)', transform: 'translate(25%, -25%)' }}
        />
        <div className="container mx-auto px-4 section-padding relative">
          <div className="max-w-3xl mx-auto text-center">
            <span className="eyebrow eyebrow-on-dark mb-4 inline-block">How it works</span>
            <h2 className="text-3xl md:text-5xl leading-tight" style={{ color: 'var(--bone)' }}>
              The bookkeeping happens on the job.
            </h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
            {steps.map((s, i) => (
              <div key={s.title} className="card-sign p-6">
                <span className="script-accent">{i + 1}.</span>
                <h3 className="mt-2 text-2xl">{s.title}</h3>
                <p className="mt-3" style={{ color: 'var(--ash)' }}>
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- CLOSING — a freshly mown lawn ---------------- */}
      <section
        className="relative overflow-hidden"
        style={{ background: 'linear-gradient(180deg, var(--paper) 0%, var(--forest-soft) 60%, var(--forest-soft) 100%)' }}
      >
        <div className="container mx-auto px-4 relative">
          <div className="max-w-2xl mx-auto text-center pt-20 md:pt-28 pb-14 md:pb-16">
            <div className="flex justify-center mb-6">
              <div className="divider-leaf divider-leaf-on-paper" />
            </div>
            <h2 className="text-4xl md:text-6xl">
              Done for the <span style={{ color: 'var(--forest)' }}>day</span>, for real.
            </h2>
            <p className="mt-5 text-lg max-w-xl mx-auto" style={{ color: 'var(--ash)' }}>
              No sitting down after work to piece the week back together.
            </p>
          </div>
        </div>

        <div className="w-full h-[240px] md:h-[320px]">
          <MownLawn haze="#D9E2D2" />
        </div>
      </section>
    </>
  );
}
