import { Suspense, lazy } from 'react';
import { Navbar } from '../components/Navbar';
import { Hero } from '../sections/Hero';
import { LogoMarquee } from '../sections/LogoMarquee';

const Stats = lazy(() => import('../sections/Stats').then((m) => ({ default: m.Stats })));
const ProductShowcase = lazy(() =>
  import('../sections/ProductShowcase').then((m) => ({ default: m.ProductShowcase })),
);
const Features = lazy(() => import('../sections/Features').then((m) => ({ default: m.Features })));
const QrFlow = lazy(() => import('../sections/QrFlow').then((m) => ({ default: m.QrFlow })));
const KitchenDisplay = lazy(() =>
  import('../sections/KitchenDisplay').then((m) => ({ default: m.KitchenDisplay })),
);
const AISection = lazy(() => import('../sections/AISection').then((m) => ({ default: m.AISection })));
const Analytics = lazy(() => import('../sections/Analytics').then((m) => ({ default: m.Analytics })));
const Testimonials = lazy(() =>
  import('../sections/Testimonials').then((m) => ({ default: m.Testimonials })),
);
const Pricing = lazy(() => import('../sections/Pricing').then((m) => ({ default: m.Pricing })));
const FAQ = lazy(() => import('../sections/FAQ').then((m) => ({ default: m.FAQ })));
const FinalCTA = lazy(() => import('../sections/FinalCTA').then((m) => ({ default: m.FinalCTA })));
const Footer = lazy(() => import('../sections/Footer').then((m) => ({ default: m.Footer })));

export default function Landing() {
  return (
    <>
      <Navbar />
      <main className="relative">
        <Hero />
        <LogoMarquee />
        <Suspense fallback={<div className="min-h-[40vh]" />}>
          <Stats />
          <ProductShowcase />
          <Features />
          <QrFlow />
          <KitchenDisplay />
          <AISection />
          <Analytics />
          <Testimonials />
          <Pricing />
          <FAQ />
          <FinalCTA />
          <Footer />
        </Suspense>
      </main>
    </>
  );
}
