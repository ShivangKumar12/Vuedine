import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { CursorGlow } from './components/effects/CursorGlow';
import { SmoothScroll } from './components/effects/SmoothScroll';
import { dashboardLinkLookup } from './pages/dashboard/nav';
import { authApi } from './services/auth';
import { authStore } from './stores/auth';

const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Login'));
const DashboardLayout = lazy(() => import('./pages/dashboard/DashboardLayout'));
const Dashboard = lazy(() => import('./pages/dashboard/Dashboard'));
const Items = lazy(() => import('./pages/dashboard/Items'));
const Tables = lazy(() => import('./pages/dashboard/Tables'));
const POS = lazy(() => import('./pages/dashboard/POS'));
const POSOrders = lazy(() => import('./pages/dashboard/POSOrders'));
const LiveOrders = lazy(() => import('./pages/dashboard/LiveOrders'));
const OnlineOrders = lazy(() => import('./pages/dashboard/OnlineOrders'));
const TableOrders = lazy(() => import('./pages/dashboard/TableOrders'));
const KDS = lazy(() => import('./pages/dashboard/KDS'));
const OSS = lazy(() => import('./pages/dashboard/OSS'));
const AllUsers = lazy(() => import('./pages/dashboard/AllUsers'));
const UserRoles = lazy(() => import('./pages/dashboard/UserRoles'));
const Transactions = lazy(() => import('./pages/dashboard/Transactions'));
const SalesReport = lazy(() => import('./pages/dashboard/SalesReport'));
const Integrations = lazy(() => import('./pages/dashboard/Integrations'));
const QRCodes = lazy(() => import('./pages/dashboard/QRCodes'));
const Subscription = lazy(() => import('./pages/dashboard/Subscription'));
const Settings = lazy(() => import('./pages/dashboard/Settings'));
const Coupons = lazy(() => import('./pages/dashboard/Coupons'));
const Offers = lazy(() => import('./pages/dashboard/Offers'));
const PushNotifications = lazy(() => import('./pages/dashboard/PushNotifications'));
const Messages = lazy(() => import('./pages/dashboard/Messages'));
const Subscribers = lazy(() => import('./pages/dashboard/Subscribers'));
const Placeholder = lazy(() => import('./pages/dashboard/Placeholder'));

// Customer-facing PWA
const GuestMenu = lazy(() => import('./guest/Menu'));
const GuestCheckout = lazy(() => import('./guest/Checkout'));
const GuestTracking = lazy(() => import('./guest/OrderTracking'));

const dashboardPages: Record<string, React.LazyExoticComponent<React.ComponentType>> = {
  '/dashboard/items': Items,
  '/dashboard/tables': Tables,
  '/dashboard/pos': POS,
  '/dashboard/pos-orders': POSOrders,
  '/dashboard/live-orders': LiveOrders,
  '/dashboard/online-orders': OnlineOrders,
  '/dashboard/table-orders': TableOrders,
  '/dashboard/kds': KDS,
  '/dashboard/oss': OSS,
  '/dashboard/users': AllUsers,
  '/dashboard/roles': UserRoles,
  '/dashboard/transactions': Transactions,
  '/dashboard/reports/sales': SalesReport,
  '/dashboard/integrations': Integrations,
  '/dashboard/qr-codes': QRCodes,
  '/dashboard/subscription': Subscription,
  '/dashboard/settings': Settings,
  '/dashboard/coupons': Coupons,
  '/dashboard/offers': Offers,
  '/dashboard/push': PushNotifications,
  '/dashboard/messages': Messages,
  '/dashboard/subscribers': Subscribers,
};

/**
 * Auth gate for everything under /dashboard. On first mount we attempt a
 * silent refresh — the cookie still being valid is enough to log the user
 * back in across reloads. If refresh fails, redirect to /login keeping the
 * intended path so we can come back after.
 */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const auth = authStore.use();
  const location = useLocation();
  const [bootstrapping, setBootstrapping] = useState(auth.status === 'idle');

  useEffect(() => {
    if (auth.status !== 'idle') return;
    let cancelled = false;
    (async () => {
      await authApi.restoreSession();
      if (!cancelled) setBootstrapping(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [auth.status]);

  if (bootstrapping || auth.status === 'authenticating') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-r-transparent" />
      </div>
    );
  }

  if (auth.status !== 'authenticated' || !auth.user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <SmoothScroll />
      <CursorGlow />
      <Suspense fallback={<div className="min-h-screen" />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <DashboardLayout />
              </RequireAuth>
            }
          >
            <Route index element={<Dashboard />} />
            {dashboardLinkLookup
              .filter((l) => l.to !== '/dashboard')
              .map((l) => {
                const Real = dashboardPages[l.to];
                return (
                  <Route
                    key={l.to}
                    path={l.to.replace(/^\/dashboard\//, '')}
                    element={Real ? <Real /> : <Placeholder />}
                  />
                );
              })}
          </Route>

          {/* Guest-facing PWA — no dashboard chrome */}
          <Route path="/m/:branch/:table" element={<GuestMenu />} />
          <Route path="/m/:branch/:table/checkout" element={<GuestCheckout />} />
          <Route path="/m/:branch/order/:orderId" element={<GuestTracking />} />

          <Route path="*" element={<Landing />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
