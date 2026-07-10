import { AppShell } from "@/components/layout/app-shell";
import { requireAdminProfile } from "@/features/auth/session";

export default async function ApplicationLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireAdminProfile();

  return <AppShell>{children}</AppShell>;
}
