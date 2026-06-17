import {
  Bell,
  Boxes,
  ChefHat,
  CreditCard,
  FileBarChart,
  Gift,
  LayoutDashboard,
  MessageCircle,
  MessageSquare,
  Monitor,
  Package,
  Plug,
  QrCode,
  Receipt,
  Radio,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Tag,
  Users,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export type DashboardLink = {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
};

export type DashboardGroup = {
  label?: string;
  items: DashboardLink[];
};

export const dashboardNav: DashboardGroup[] = [
  {
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/dashboard/items', label: 'Items', icon: UtensilsCrossed },
      { to: '/dashboard/tables', label: 'Dining Tables', icon: Package },
    ],
  },
  {
    label: 'POS & Orders',
    items: [
      { to: '/dashboard/pos', label: 'POS', icon: ShoppingBag },
      { to: '/dashboard/live-orders', label: 'Live Orders', icon: Radio, badge: 'NEW' },
      { to: '/dashboard/pos-orders', label: 'POS Orders', icon: Receipt, badge: '12' },
      { to: '/dashboard/online-orders', label: 'Online Orders', icon: Smartphone, badge: '4' },
      { to: '/dashboard/table-orders', label: 'Table Orders', icon: Boxes },
      { to: '/dashboard/kds', label: 'K.D.S', icon: ChefHat },
      { to: '/dashboard/oss', label: 'O.S.S', icon: Monitor },
    ],
  },
  {
    label: 'Promo',
    items: [
      { to: '/dashboard/coupons', label: 'Coupons', icon: Tag },
      { to: '/dashboard/offers', label: 'Offers', icon: Gift },
    ],
  },
  {
    label: 'Communications',
    items: [
      { to: '/dashboard/push', label: 'Push Notifications', icon: Bell },
      { to: '/dashboard/messages', label: 'Messages', icon: MessageSquare },
      { to: '/dashboard/subscribers', label: 'Subscribers', icon: MessageCircle },
    ],
  },
  {
    label: 'Users',
    items: [
      { to: '/dashboard/users', label: 'All Users', icon: Users },
      { to: '/dashboard/roles', label: 'User Roles', icon: ShieldCheck },
    ],
  },
  {
    label: 'Accounts',
    items: [
      { to: '/dashboard/transactions', label: 'Transactions', icon: Wallet },
      { to: '/dashboard/subscription', label: 'Subscription', icon: CreditCard },
    ],
  },
  {
    label: 'Reports',
    items: [{ to: '/dashboard/reports/sales', label: 'Sales Report', icon: FileBarChart }],
  },
  {
    label: 'Setup',
    items: [
      { to: '/dashboard/qr-codes', label: 'QR Codes', icon: QrCode },
      { to: '/dashboard/integrations', label: 'Integrations', icon: Plug, badge: '4' },
      { to: '/dashboard/settings', label: 'Settings', icon: Settings },
    ],
  },
];

// Quick lookup for non-dashboard placeholder routes
export const dashboardLinkLookup = dashboardNav.flatMap((g) => g.items);
