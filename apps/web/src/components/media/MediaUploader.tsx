'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Loader2, Image as ImageIcon, Video, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/hooks/use-toast';
import { MediaRequirement } from '@/lib/hooks/use-content-detail';
import { apiClient } from '@/lib/api-client';

interface MediaUploaderProps {
  contentIdeaId: string;
  mediaRequirement: MediaRequirement;
  onUploadComplete: (assetId: string, url: string) => void;
  className?: string;
}

export function MediaUploader({ contentIdeaId, mediaRequirement, onUploadComplete, className }: MediaUploaderProps) {
  const [files, setFiles] = useState<{ file: File; previewUrl: string }[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const isVideo = mediaRequirement.mediaType === 'VIDEO' || mediaRequirement.mediaType === 'video_placeholder';
  const isCarousel = mediaRequirement.mediaType === 'CAROUSEL';
  
  const acceptedTypes: Record<string, string[]> = isVideo 
    ? { 'video/mp4': ['.mp4'], 'video/quicktime': ['.mov'] }
    : { 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'], 'image/webp': ['.webp'] };

  const maxFiles = isCarousel ? 10 : 1;

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    const validFiles = acceptedFiles.filter(f => f.size <= maxSize);

    if (validFiles.length < acceptedFiles.length) {
      toast({
        variant: 'destructive',
        title: 'Files too large',
        description: `Maximum file size is ${isVideo ? '50MB' : '10MB'}. Some files were ignored.`
      });
    }

    if (validFiles.length === 0) return;

    const newFiles = validFiles.map(file => ({
      file,
      previewUrl: URL.createObjectURL(file)
    }));

    setFiles(prev => {
      const combined = [...prev, ...newFiles];
      if (combined.length > maxFiles) {
        toast({
          variant: 'destructive',
          title: 'Too many files',
          description: `You can only upload up to ${maxFiles} files.`
        });
        return combined.slice(0, maxFiles);
      }
      return combined;
    });
  }, [isVideo, maxFiles]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: acceptedTypes,
    maxFiles,
  });

  const removeFile = (index: number) => {
    setFiles(prev => {
      const newFiles = [...prev];
      if (newFiles[index]) URL.revokeObjectURL(newFiles[index]!.previewUrl);
      newFiles.splice(index, 1);
      return newFiles;
    });
    setProgress(0);
  };

  const moveFile = (index: number, direction: 'left' | 'right') => {
    setFiles(prev => {
      const newFiles = [...prev];
      if (direction === 'left' && index > 0) {
        [newFiles[index - 1], newFiles[index]] = [newFiles[index]!, newFiles[index - 1]!];
      } else if (direction === 'right' && index < newFiles.length - 1) {
        [newFiles[index], newFiles[index + 1]] = [newFiles[index + 1]!, newFiles[index]!];
      }
      return newFiles;
    });
  };

  const uploadFile = async () => {
    if (files.length === 0) return;

    setIsUploading(true);
    setProgress(10); // Simulated start

    try {
      const progressInterval = setInterval(() => {
        setProgress(p => Math.min(p + 5, 90));
      }, 300);

      // 1. Get presigned URLs
      const presignedData = await apiClient.post<{ urls: any[], mediaRequirementId: string }>('/api/media/upload-url', {
        contentIdeaId,
        mediaRequirementId: mediaRequirement.id,
        files: files.map(f => ({ filename: f.file.name, mimetype: f.file.type, size: f.file.size }))
      });
      
      const { urls, mediaRequirementId: actualReqId } = presignedData;
      const reqIdToUse = actualReqId || mediaRequirement.id;
      
      // 2. Upload files to S3 directly
      const uploadedFiles: { key: string; mimetype: string }[] = [];
      for (let i = 0; i < files.length; i++) {
        const fileObj = files[i];
        const urlObj = urls[i];
        if (!fileObj || !urlObj) continue;

        const uploadRes = await fetch(urlObj.uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': fileObj.file.type,
          },
          body: fileObj.file,
        });

        if (!uploadRes.ok) {
          throw new Error(`Failed to upload ${fileObj.file.name} to cloud storage`);
        }
        
        uploadedFiles.push({
          key: urlObj.key,
          mimetype: fileObj.file.type
        });
      }

      // 3. Confirm upload
      const confirmData = await apiClient.post<any>('/api/media/confirm-upload', {
        contentIdeaId,
        mediaRequirementId: reqIdToUse,
        files: uploadedFiles
      });

      clearInterval(progressInterval);
      setProgress(100);
      
      toast({
        title: 'Upload Successful',
        description: `Your media has been attached to the content.`,
      });

      onUploadComplete(confirmData.assetId, confirmData.key);
    } catch (error: any) {
      console.error('Media upload error:', error);
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

  if (files.length > 0) {
    return (
      <div className={cn("rounded-lg border bg-card p-4 space-y-4", className)}>
        <div className={cn("grid gap-4", files.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
          {files.map((f, i) => (
            <div key={i} className="relative aspect-video rounded-md overflow-hidden bg-muted flex items-center justify-center group">
              {isVideo ? (
                <video src={f.previewUrl} className="w-full h-full object-contain" controls />
              ) : (
                <img src={f.previewUrl} alt="Preview" className="w-full h-full object-contain" />
              )}
              
              {!isUploading && (
                <>
                  {isCarousel && files.length > 1 && (
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded-lg p-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); moveFile(i, 'left'); }}
                        disabled={i === 0}
                        className="p-1 rounded hover:bg-white/20 text-white disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span className="text-white text-xs font-medium px-1">{i + 1} / {files.length}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); moveFile(i, 'right'); }}
                        disabled={i === files.length - 1}
                        className="p-1 rounded hover:bg-white/20 text-white disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  <button 
                    onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/80 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        {isCarousel && files.length < maxFiles && !isUploading && (
          <div {...getRootProps()} className="rounded-md border-2 border-dashed p-4 text-center cursor-pointer hover:bg-accent/50 transition-colors">
            <input {...getInputProps()} />
            <p className="text-xs text-muted-foreground">+ Add more files ({files.length}/{maxFiles})</p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1 mr-4">
            <p className="text-sm font-medium truncate">{files.length} file{files.length !== 1 ? 's' : ''} selected</p>
            <p className="text-xs text-muted-foreground">
              {(files.reduce((acc, f) => acc + f.file.size, 0) / 1024 / 1024).toFixed(2)} MB total
            </p>
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
        {isDragActive ? 'Drop file(s) here' : 'Drag & drop media here'}
      </p>
      <p className="text-xs text-muted-foreground">
        or click to browse {isVideo ? '(MP4, MOV)' : '(JPG, PNG, WebP)'} up to {isVideo ? '50MB' : '10MB'}. 
        {isCarousel && ` You can select up to ${maxFiles} files.`}
      </p>
    </div>
  );
}
