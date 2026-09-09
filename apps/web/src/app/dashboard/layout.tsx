import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Overview',
  '/dashboard/agent': 'Agent Status',
  '/dashboard/content': 'Content Calendar',
  '/dashboard/strategy': 'Strategy',
  '/dashboard/analytics': 'Analytics',
  '/dashboard/research': 'Research',
  '/dashboard/settings': 'Settings',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header title="Evolvr Dashboard" />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
