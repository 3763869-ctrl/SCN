import {
  BarChart3,
  Clock3,
  Folder,
  FileChartColumn,
  FileText,
  HandCoins,
  Handshake,
  LayoutDashboard,
  ReceiptText,
  Settings,
  WalletCards,
  Users,
} from "lucide-react";

export const navigationItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Partners", href: "/partners", icon: Handshake },
  { label: "Workers", href: "/workers", icon: Users },
  { label: "Time Tracking", href: "/time-tracking", icon: Clock3 },
  { label: "Payroll", href: "/payroll", icon: HandCoins },
  { label: "Invoices", href: "/invoices", icon: FileText },
  { label: "Income", href: "/income", icon: WalletCards },
  { label: "Expenses", href: "/expenses", icon: ReceiptText },
  { label: "Partner Payroll", href: "/settlements", icon: HandCoins },
  { label: "Reports", href: "/reports", icon: FileChartColumn },
  { label: "Documents", href: "/documents", icon: Folder },
  { label: "Settings", href: "/settings", icon: Settings },
] as const;

export const overviewItems = [
  { label: "Analytics", href: "/reports", icon: BarChart3 },
] as const;
