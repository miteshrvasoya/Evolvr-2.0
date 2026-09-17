'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Bot,
  Calendar,
  FlaskConical,
  History,
  LayoutDashboard,
  Search,
  Settings,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  {
    label: 'Agent Status',
    icon: Bot,
    href: '/dashboard/agent', // Base route
    subItems: [
      { href: '/dashboard/agent', label: 'Live Status' },
      { href: '/dashboard/agent/runs', label: 'Run History' },
    ],
  },
  { href: '/dashboard/content', label: 'Content Calendar', icon: Calendar },
  { href: '/dashboard/strategy', label: 'Strategy', icon: Target },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/research', label: 'Research', icon: Search },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

function NavItem({ item, pathname }: { item: any; pathname: string }) {
  const Icon = item.icon;
  const isActive = item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href);

  if (item.subItems) {
    return (
      <li className="space-y-1">
        <div
          className={cn(
            'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
          )}
        >
          <Icon className="h-4 w-4 shrink-0" />
          {item.label}
        </div>
        <ul className="pl-6 pr-2 space-y-1">
          {item.subItems.map((sub: any) => {
            const isSubActive = pathname === sub.href;
            return (
              <li key={sub.href}>
                <Link
                  href={sub.href}
                  className={cn(
                    'block rounded-md px-3 py-1.5 text-sm transition-colors',
                    isSubActive
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  {sub.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </li>
    );
  }

  return (
    <li>
      <Link
        href={item.href}
        className={cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {item.label}
      </Link>
    </li>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-card">
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center gap-2 border-b px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <Bot className="h-5 w-5 text-primary-foreground" />
        </div>
        <span className="text-lg font-bold">Evolvr</span>
        <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
          AI
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {navItems.map((item, idx) => (
            <NavItem key={idx} item={item} pathname={pathname} />
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className="shrink-0 border-t p-4">
        <p className="text-xs text-muted-foreground">Evolvr v0.1.0</p>
      </div>
    </aside>
  );
}
