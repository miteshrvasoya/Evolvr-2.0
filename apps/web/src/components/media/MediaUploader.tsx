'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Loader2, Image as ImageIcon, Video, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/hooks/use-toast';
import { MediaRequirement } from '@/lib/types/content';

interface MediaUploaderProps {
  contentIdeaId: string;
  mediaRequirement: MediaRequirement;
  onUploadComplete: (assetId: string, url: string) => void;
  className?: string;
}

export function MediaUploader({ contentIdeaId, mediaRequirement, onUploadComplete, className }: MediaUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const isVideo = mediaRequirement.mediaType === 'VIDEO' || mediaRequirement.mediaType === 'video_placeholder';
  const acceptedTypes = isVideo 
    ? { 'video/mp4': ['.mp4'], 'video/quicktime': ['.mov'] }
    : { 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'], 'image/webp': ['.webp'] };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    const selected = acceptedFiles[0];
    
    // Size validation (e.g., 50MB for video, 10MB for image)
    const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (selected.size > maxSize) {
      toast({
        variant: 'destructive',
        title: 'File too large',
        description: `Maximum file size is ${isVideo ? '50MB' : '10MB'}.`
      });
      return;
    }

    setFile(selected);
    const url = URL.createObjectURL(selected);
    setPreviewUrl(url);
  }, [isVideo]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: acceptedTypes,
    maxFiles: 1,
  });

  const removeFile = () => {
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setProgress(0);
  };

  const uploadFile = async () => {
    if (!file) return;

    setIsUploading(true);
    setProgress(10); // Simulated start

    const formData = new FormData();
    formData.append('file', file);
    formData.append('contentIdeaId', contentIdeaId);
    formData.append('mediaRequirementId', mediaRequirement.id);

    try {
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setProgress(p => Math.min(p + 10, 90));
      }, 300);

      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/media/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Upload failed');
      }

      const data = await response.json();
      
      toast({
        title: 'Upload Successful',
        description: 'Your media has been attached to the content.',
      });

      onUploadComplete(data.assetId, data.storageUrl);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Upload Failed',
        description: error.message,
      });
      setProgress(0);
    } finally {
      setIsUploading(false);
    }
  };

  if (file && previewUrl) {
    return (
      <div className={cn("rounded-lg border bg-card p-4 space-y-4", className)}>
        <div className="relative aspect-video rounded-md overflow-hidden bg-muted flex items-center justify-center group">
          {isVideo ? (
            <video src={previewUrl} className="w-full h-full object-contain" controls />
          ) : (
            <img src={previewUrl} alt="Preview" className="w-full h-full object-contain" />
          )}
          
          {!isUploading && (
            <button 
              onClick={removeFile}
              className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/80 transition-colors opacity-0 group-hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1 mr-4">
            <p className="text-sm font-medium truncate">{file.name}</p>
            <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
          </div>
          <Button onClick={uploadFile} disabled={isUploading} size="sm">
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Confirm Upload
              </>
            )}
          </Button>
        </div>
        {isUploading && <Progress value={progress} className="h-1.5" />}
      </div>
    );
  }

  return (
    <div 
      {...getRootProps()} 
      className={cn(
        "rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-colors hover:bg-accent/50",
        isDragActive && "border-primary bg-primary/5",
        isDragReject && "border-destructive bg-destructive/5",
        className
      )}
    >
      <input {...getInputProps()} />
      <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
        {isVideo ? <Video className="h-6 w-6 text-muted-foreground" /> : <ImageIcon className="h-6 w-6 text-muted-foreground" />}
      </div>
      <p className="text-sm font-medium mb-1">
        {isDragActive ? 'Drop file here' : 'Drag & drop media here'}
      </p>
      <p className="text-xs text-muted-foreground">
        or click to browse {isVideo ? '(MP4, MOV)' : '(JPG, PNG, WebP)'} up to {isVideo ? '50MB' : '10MB'}
      </p>
    </div>
  );
}
