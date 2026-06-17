const logos = [
  'Bombay Canteen',
  'Theobroma',
  'Social',
  'Burger Singh',
  'Chaayos',
  'Olive Bistro',
  'Farzi Café',
  'Indigo Deli',
  'Smoke House',
  'Sodabottle',
  'Mainland China',
  'BLR Brewing',
];

export function LogoMarquee() {
  return (
    <section aria-label="Trusted by" className="relative -mt-6 border-y border-ink-100 bg-white/70 py-10 backdrop-blur">
      <div className="mx-auto mb-6 max-w-3xl px-6 text-center text-xs font-semibold uppercase tracking-[0.2em] text-ink-500">
        Trusted by 12,000+ restaurants, cafés, hotels and food chains
      </div>
      <div className="mask-fade-x relative overflow-hidden">
        <div className="marquee-track">
          {[...logos, ...logos].map((name, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-2 text-lg font-bold text-ink-400 transition hover:text-brand-600"
            >
              <span className="inline-block h-2 w-2 rounded-full bg-gradient-to-br from-brand-500 to-warm-500" />
              <span className="whitespace-nowrap tracking-tight">{name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
