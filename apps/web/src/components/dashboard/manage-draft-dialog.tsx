import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, ImagePlus, Check, X } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import { toast } from '@/lib/hooks/use-toast';

export function ManageDraftDialog({ draft, onApprove, onUpdate, onUpload, children }: { 
  draft: any; 
  onApprove: (scheduledAt: string) => Promise<void>; 
  onUpdate: (data: { caption?: string; hook?: string }) => Promise<void>;
  onUpload: (file: File) => Promise<void>;
  children: React.ReactNode; 
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scheduledAt, setScheduledAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  
  const [caption, setCaption] = useState(draft.caption || '');
  const [hook, setHook] = useState(draft.hook || '');

  const asset = draft.assets?.[0];

  async function handleApprove() {
    setLoading(true);
    try {
      await onUpdate({ caption, hook });
      await onApprove(new Date(scheduledAt).toISOString());
      toast({ title: 'Scheduled successfully' });
      setOpen(false);
    } catch {
      toast({ variant: 'destructive', title: 'Failed to schedule' });
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      await onUpload(file);
      toast({ title: 'Image uploaded' });
    } catch {
      toast({ variant: 'destructive', title: 'Upload failed' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Draft &amp; Prompts</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          {/* Media & Details Column */}
          <div className="space-y-4">
            <div className="aspect-square bg-muted rounded-lg border relative overflow-hidden flex items-center justify-center">
              {asset?.storage_url ? (
                <img src={asset.storage_url} className="w-full h-full object-cover" alt="Draft" />
              ) : (
                <span className="text-muted-foreground text-sm">No media generated</span>
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity">
                <Label htmlFor={`upload-${draft.id}`} className="cursor-pointer bg-white text-black px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2">
                  <ImagePlus className="w-4 h-4" /> Replace Image
                </Label>
                <input type="file" id={`upload-${draft.id}`} className="hidden" accept="image/*" onChange={handleUpload} disabled={loading} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>AI Image Generation Prompt (For Manual Fallback)</Label>
              <Textarea readOnly value={asset?.prompt || 'No image prompt available.'} className="text-xs h-24 bg-muted/50" />
            </div>
          </div>

          {/* Editor & Scheduling Column */}
          <div className="space-y-4">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-primary uppercase">{draft.format} • {draft.pillar}</span>
              <p className="text-sm text-muted-foreground">Concept: {draft.concept}</p>
            </div>

            <div className="space-y-2">
              <Label>Hook</Label>
              <Input value={hook} onChange={(e) => setHook(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Caption &amp; Hashtags</Label>
              <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} className="h-40" />
            </div>

            <div className="space-y-2 pt-2 border-t">
              <Label>Schedule For</Label>
              <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
              <p className="text-[11px] text-muted-foreground">The AI suggested this trend-optimized time.</p>
            </div>
            
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleApprove} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Approve &amp; Schedule
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
