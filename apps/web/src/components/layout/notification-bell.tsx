'use client';

import { Bell } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import { useNotifications } from '@/lib/hooks/use-notifications';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const priorityColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-amber-100 text-amber-800',
  low: 'bg-slate-100 text-slate-700',
};

export function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const recent = notifications.slice(0, 5);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-primary hover:underline font-normal"
            >
              Mark all read
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {recent.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">No notifications</div>
        ) : (
          recent.map((n) => (
            <DropdownMenuItem
              key={n.id}
              onClick={() => markRead(n.id)}
              className={cn('flex flex-col items-start gap-1 py-3', n.status === 'unread' && 'bg-accent/40')}
            >
              <div className="flex w-full items-start justify-between gap-2">
                <span className="text-sm font-medium leading-tight">{n.title}</span>
                <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold', priorityColors[n.priority] ?? '')}>
                  {n.priority}
                </span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
              <p className="text-[11px] text-muted-foreground">{formatDateTime(n.createdAt)}</p>
            </DropdownMenuItem>
          ))
        )}
        {notifications.length > 5 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="justify-center text-sm text-primary">
              View all notifications
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
