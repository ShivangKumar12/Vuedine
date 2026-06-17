import { ArrowRight, Github, Linkedin, Twitter, Youtube } from 'lucide-react';
import { Logo } from '../components/Logo';

const cols = [
  {
    title: 'Product',
    links: ['Smart POS', 'QR Ordering', 'Kitchen Display', 'Reservations', 'CRM & Loyalty', 'Analytics', 'Vuedine AI'],
  },
  {
    title: 'Solutions',
    links: ['Cafés', 'Quick Service', 'Fine Dining', 'Cloud Kitchens', 'Bars & Pubs', 'Hotels', 'Multi-outlet Chains'],
  },
  {
    title: 'Resources',
    links: ['Help Center', 'Onboarding Guide', 'Changelog', 'Restaurant Playbook', 'API Docs', 'Status Page', 'Security'],
  },
  {
    title: 'Company',
    links: ['About', 'Customers', 'Press', 'Careers · Hiring', 'Partners', 'Contact', 'Blog'],
  },
];

export function Footer() {
  return (
    <footer className="relative border-t border-ink-100 bg-white pt-20 pb-10">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Logo />
            <p className="mt-4 max-w-sm text-sm text-ink-600">
              The AI-powered Restaurant Operating System. POS, QR Ordering, Kitchen Display, Reservations, Analytics — one beautiful platform.
            </p>

            <form className="mt-6 max-w-sm">
              <label className="text-xs font-bold uppercase tracking-widest text-ink-500">Restaurant Playbook</label>
              <div className="mt-2 flex items-center gap-2 rounded-2xl border border-ink-200 bg-white p-1 pl-4 shadow-sm">
                <input
                  type="email"
                  placeholder="you@restaurant.com"
                  className="flex-1 bg-transparent py-2.5 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none"
                />
                <button className="btn-primary shine inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold">
                  Subscribe
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
              <p className="mt-2 text-[11px] text-ink-500">
                Monthly · operator interviews, growth playbooks, AI prompts. No spam.
              </p>
            </form>

            <div className="mt-7 flex gap-2">
              {[Twitter, Linkedin, Github, Youtube].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-ink-200 bg-white text-ink-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:col-span-8">
            {cols.map((c) => (
              <div key={c.title}>
                <div className="text-xs font-bold uppercase tracking-widest text-ink-900">{c.title}</div>
                <ul className="mt-4 space-y-2.5 text-sm text-ink-600">
                  {c.links.map((l) => (
                    <li key={l}>
                      <a href="#" className="font-medium transition hover:text-brand-600">
                        {l}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 flex flex-col items-start justify-between gap-4 border-t border-ink-100 pt-6 text-xs text-ink-500 md:flex-row md:items-center">
          <div className="font-medium">© 2026 Vuedine Technologies. Crafted in Bengaluru, India · Mumbai · Delhi.</div>
          <div className="flex flex-wrap gap-5 font-medium">
            <a href="#" className="hover:text-brand-600">Privacy</a>
            <a href="#" className="hover:text-brand-600">Terms</a>
            <a href="#" className="hover:text-brand-600">DPA</a>
            <a href="#" className="hover:text-brand-600">Security</a>
            <a href="#" className="hover:text-brand-600">Cookies</a>
          </div>
        </div>
      </div>

      <div aria-hidden className="pointer-events-none mt-10 select-none overflow-hidden px-6">
        <div className="display flex justify-center bg-gradient-to-b from-brand-200 to-transparent bg-clip-text pb-4 text-[clamp(64px,18vw,260px)] font-black leading-none tracking-tighter text-transparent">
          VUEDINE
        </div>
      </div>
    </footer>
  );
}
