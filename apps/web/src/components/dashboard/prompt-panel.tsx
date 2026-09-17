'use client';

import { useState, useRef } from 'react';
import type { ContentPrompt } from '@/lib/hooks/use-content-detail';
import { useAssetActions } from '@/lib/hooks/use-asset-actions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Copy, Check, ChevronDown, ChevronRight, Pencil, Sparkles, Loader2, History
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { toast } from '@/lib/hooks/use-toast';

interface PromptPanelProps {
  ideaId: string;
  prompts: ContentPrompt[];
  onRefresh: () => void;
}

const SOURCE_LABELS: Record<string, { label: string; cls: string }> = {
  ai_generated: { label: 'AI Generated', cls: 'text-purple-600' },
  user_edited:  { label: 'User Edited',  cls: 'text-blue-600'   },
  improved:     { label: 'AI Improved',  cls: 'text-emerald-600' },
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5 h-7 text-xs">
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied!' : 'Copy Prompt'}
    </Button>
  );
}

function PromptVersion({
  prompt,
  isCurrent,
  ideaId,
  onRefresh,
}: {
  prompt: ContentPrompt;
  isCurrent: boolean;
  ideaId: string;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(isCurrent);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(prompt.promptText);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { editPrompt } = useAssetActions(ideaId, onRefresh);
  const sourceInfo = SOURCE_LABELS[prompt.source] ?? SOURCE_LABELS['ai_generated']!;

  async function handleSaveEdit() {
    if (!editText.trim()) return;
    setSaving(true);
    try {
      await editPrompt(prompt.id, editText);
      toast({ title: 'Prompt saved', description: 'A new user-edited version has been created.' });
      setEditing(false);
      onRefresh();
    } catch {
      toast({ variant: 'destructive', title: 'Failed to save prompt' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={cn(
      'rounded-lg border transition-colors',
      isCurrent ? 'bg-primary/5 border-primary/20' : 'bg-card',
    )}>
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between gap-3 p-3 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
          <span className="text-sm font-semibold">
            v{prompt.promptVersion}
          </span>
          {isCurrent && <Badge className="text-[10px] px-1.5 py-0 h-4">Current</Badge>}
          <span className={cn('text-xs font-medium', sourceInfo.cls)}>{sourceInfo.label}</span>
        </div>
        <span className="text-[10px] text-muted-foreground shrink-0">
          {formatDistanceToNow(new Date(prompt.createdAt), { addSuffix: true })}
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {editing ? (
            <div className="space-y-2">
              <textarea
                ref={textareaRef}
                value={editText}
                onChange={e => setEditText(e.target.value)}
                className="w-full text-xs font-mono rounded-md border bg-background p-2 h-28 resize-none focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveEdit} disabled={saving} className="h-7 text-xs gap-1">
                  {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                  Save as New Version
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setEditText(prompt.promptText); }} className="h-7 text-xs">
                  Cancel
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                This will create a new user-edited version. The original AI prompt is preserved.
              </p>
            </div>
          ) : (
            <div className="rounded-md bg-muted/40 border p-2.5 text-xs font-mono leading-relaxed whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
              {prompt.promptText}
            </div>
          )}

          {!editing && (
            <div className="flex flex-wrap gap-1.5">
              <CopyButton text={prompt.promptText} />
              {isCurrent && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(true)}
                  className="gap-1 h-7 text-xs"
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function PromptPanel({ ideaId, prompts, onRefresh }: PromptPanelProps) {
  const [showAll, setShowAll] = useState(false);
  const { isImproving, improvePrompt } = useAssetActions(ideaId, onRefresh);

  // Group by asset type
  const imagePrompts = prompts.filter(p => p.assetType === 'image').sort((a, b) => b.promptVersion - a.promptVersion);
  const videoPrompts = prompts.filter(p => p.assetType === 'video_placeholder').sort((a, b) => b.promptVersion - a.promptVersion);

  async function handleImproveAll(assetType: string) {
    try {
      const improved = await improvePrompt(assetType);
      toast({ title: 'Prompt improved', description: 'New improved prompt version created.' });
    } catch {
      toast({ variant: 'destructive', title: 'Failed to improve prompt' });
    }
  }

  if (prompts.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center">
        <History className="h-7 w-7 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No prompts available yet.</p>
        <p className="text-xs text-muted-foreground/60 mt-1">AI-generated image/video prompts will appear here.</p>
      </div>
    );
  }

  function PromptGroup({ title, groupPrompts, assetType }: { title: string; groupPrompts: ContentPrompt[]; assetType: string }) {
    const displayed = showAll ? groupPrompts : groupPrompts.slice(0, 2);
    if (groupPrompts.length === 0) return null;

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleImproveAll(assetType)}
            disabled={isImproving}
            className="h-6 text-xs gap-1 text-purple-600 hover:text-purple-700"
          >
            {isImproving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Improve
          </Button>
        </div>
        <div className="space-y-2">
          {displayed.map((p, i) => (
            <PromptVersion
              key={p.id}
              prompt={p}
              isCurrent={i === 0}
              ideaId={ideaId}
              onRefresh={onRefresh}
            />
          ))}
          {!showAll && groupPrompts.length > 2 && (
            <button
              onClick={() => setShowAll(true)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              <History className="h-3 w-3" />
              Show {groupPrompts.length - 2} older version{groupPrompts.length - 2 > 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PromptGroup title="Image Prompts" groupPrompts={imagePrompts} assetType="image" />
      <PromptGroup title="Video Prompts" groupPrompts={videoPrompts} assetType="video_placeholder" />
    </div>
  );
}
