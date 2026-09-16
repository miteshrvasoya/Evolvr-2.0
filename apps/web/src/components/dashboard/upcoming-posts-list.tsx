'use client';

import {
  Calendar,
  ImageIcon,
  Video,
  LayoutTemplate,
  Clock,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Post } from '@evolvr/types';
import { PostStatusBadge } from './post-status-badge';
import { cn } from '@/lib/utils';

interface UpcomingPostsListProps {
  posts: Post[];
}

const mediaIcons: Record<string, React.ElementType> = {
  reel: Video,
  story: Video,
  live: Video,
  carousel: LayoutTemplate,
  static: ImageIcon,
};

function formatRelativeTime(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (diff < 0) return 'Overdue';
  if (hours < 1) return `in ${mins}m`;
  if (hours < 24) return `in ${hours}h ${mins > 0 ? `${mins}m` : ''}`.trim();
  const days = Math.floor(hours / 24);
  return `in ${days}d`;
}

function formatScheduledDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function UpcomingPostsList({ posts }: UpcomingPostsListProps) {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-orange-500/10">
            <Calendar className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
          </div>
          Upcoming Posts
          {posts.length > 0 && (
            <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/10 px-1.5 text-[10px] font-bold text-primary">
              {posts.length}
            </span>
          )}
        </CardTitle>
        <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
          <Link href="/dashboard/content">
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        {posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <Calendar className="h-5 w-5 text-muted-foreground opacity-50" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">No posts scheduled</p>
            <p className="mt-1 text-xs text-muted-foreground/60">The agent will schedule posts based on your strategy.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {posts.slice(0, 4).map((post) => {
              const MediaIcon = mediaIcons[post.mediaType ?? ''] ?? ImageIcon;
              const scheduled = post.scheduledAt ? formatScheduledDate(post.scheduledAt) : null;
              const relative = post.scheduledAt ? formatRelativeTime(post.scheduledAt) : null;
              const isOverdue = post.scheduledAt && new Date(post.scheduledAt).getTime() < Date.now();

              return (
                <li
                  key={post.id}
                  className="group flex items-start gap-3 rounded-lg border bg-muted/30 p-3 transition-colors hover:bg-muted/60"
                >
                  {/* Media type icon */}
                  <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-background border shadow-sm">
                    <MediaIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-xs font-medium text-foreground leading-relaxed">
                      {post.caption}
                    </p>
                    {scheduled && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <Clock className="h-2.5 w-2.5 text-muted-foreground flex-shrink-0" />
                        <span className="text-[10px] text-muted-foreground">{scheduled}</span>
                        <span className={cn(
                          'text-[10px] font-semibold',
                          isOverdue ? 'text-red-500' : 'text-primary',
                        )}>
                          ({relative})
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Status */}
                  <PostStatusBadge status={post.status} />
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
