import {
  BarChart3,
  BriefcaseBusiness,
  Building2,
  Clock3,
  FileChartColumn,
  FileText,
  HandCoins,
  LayoutDashboard,
  Receipt,
  Settings,
  Users,
  WalletCards,
} from "lucide-react";

export const navigationItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Clients", href: "/clients", icon: Building2 },
  { label: "Workers", href: "/workers", icon: Users },
  { label: "Time Tracking", href: "/time-tracking", icon: Clock3 },
  { label: "Production (Units)", href: "/production", icon: BriefcaseBusiness },
  { label: "Payroll", href: "/payroll", icon: HandCoins },
  { label: "Invoices", href: "/invoices", icon: FileText },
  { label: "Expenses", href: "/expenses", icon: WalletCards },
  { label: "Taxes", href: "/taxes", icon: Receipt },
  { label: "Reports", href: "/reports", icon: FileChartColumn },
  { label: "Settings", href: "/settings", icon: Settings },
] as const;

export const overviewItems = [
  { label: "Analytics", href: "/reports", icon: BarChart3 },
] as const;
