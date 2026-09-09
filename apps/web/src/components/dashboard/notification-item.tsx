import type { Notification } from '@evolvr/types';
import { formatDateTime } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface NotificationItemProps {
  notification: Notification;
  onClick?: () => void;
}

export function NotificationItem({ notification, onClick }: NotificationItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-4 py-3 hover:bg-accent transition-colors',
        notification.status === 'unread' && 'bg-blue-50/50',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium">{notification.title}</p>
        {notification.status === 'unread' && (
          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
        )}
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{notification.message}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{formatDateTime(notification.createdAt)}</p>
    </button>
  );
}
