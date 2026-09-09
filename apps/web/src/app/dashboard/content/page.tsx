'use client';

import { useState } from 'react';
import { useContentCalendar } from '@/lib/hooks/use-content-calendar';
import { PostStatusBadge } from '@/components/dashboard/post-status-badge';
import { ContentIdeaCard } from '@/components/dashboard/content-idea-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime } from '@/lib/utils';
import { toast } from '@/lib/hooks/use-toast';
import type { Post, ContentIdea } from '@evolvr/types';

function PostRow({ post, idea, onApprove, onReject }: {
  post: Post;
  idea?: ContentIdea;
  onApprove?: () => void;
  onReject?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b last:border-0">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-start justify-between gap-3 py-3 text-left hover:bg-accent/30 px-2 rounded transition-colors"
      >
        <div className="flex items-start gap-3 min-w-0">
          <Badge variant="outline" className="shrink-0 capitalize">{post.mediaType}</Badge>
          <div className="min-w-0">
            <p className="text-sm line-clamp-2">{post.caption}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatDateTime(post.scheduledAt)}
              {post.failureReason && ` · Error: ${post.failureReason}`}
            </p>
          </div>
        </div>
        <PostStatusBadge status={post.status} />
      </button>

      {expanded && idea && (
        <div className="px-2 pb-3">
          <ContentIdeaCard
            idea={idea}
            onApprove={onApprove}
            onReject={onReject}
            showActions={post.status === 'waiting_approval'}
          />
        </div>
      )}
    </div>
  );
}

export default function ContentPage() {
  const { data, isLoading, approvePost, rejectPost } = useContentCalendar();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-80" />
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
      </div>
    );
  }

  if (!data) return null;

  async function handleApprove(postId: string) {
    try {
      await approvePost(postId);
      toast({ title: 'Post approved', description: 'The post has been approved for publishing.' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not approve post.' });
    }
  }

  async function handleReject(postId: string) {
    try {
      await rejectPost(postId, 'Rejected by admin');
      toast({ title: 'Post rejected', description: 'The post has been rejected.' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not reject post.' });
    }
  }

  const tabs = [
    { key: 'scheduled', label: 'Scheduled', posts: data.scheduled },
    { key: 'awaiting', label: 'Awaiting Review', posts: data.awaitingReview },
    { key: 'published', label: 'Published', posts: data.published },
    { key: 'failed', label: 'Failed', posts: data.failed },
  ] as const;

  return (
    <div className="space-y-6">
      <Tabs defaultValue="scheduled">
        <TabsList>
          {tabs.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key}>
              {tab.label}
              {tab.posts.length > 0 && (
                <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold">
                  {tab.posts.length}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map((tab) => (
          <TabsContent key={tab.key} value={tab.key}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{tab.label} Posts</CardTitle>
              </CardHeader>
              <CardContent>
                {tab.posts.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No {tab.label.toLowerCase()} posts
                  </p>
                ) : (
                  <div>
                    {tab.posts.map((post) => (
                      <PostRow
                        key={post.id}
                        post={post}
                        idea={data.ideas[post.contentIdeaId]}
                        onApprove={() => handleApprove(post.id)}
                        onReject={() => handleReject(post.id)}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
