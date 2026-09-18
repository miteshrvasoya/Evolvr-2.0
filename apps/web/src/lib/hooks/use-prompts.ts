import { useState, useCallback, useEffect } from 'react';
import { toast } from './use-toast';
import { apiClient } from '@/lib/api-client';

export interface PromptDto {
  id: string;
  promptText: string;
  promptVersion: number;
  assetType: string;
  source: string;
  status: string;
  createdAt: string;
  contentIdeaId: string;
  concept: string;
  format: string;
  mediaRequirementId: string;
  mediaStatus: string;
  strategyVersion: number;
  storageUrl?: string;
}

export function usePrompts(status?: string, type?: string) {
  const [prompts, setPrompts] = useState<PromptDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPrompts = useCallback(async () => {
    try {
      setIsLoading(true);
      
      const query = new URLSearchParams();
      if (status) query.append('status', status);
      if (type) query.append('type', type);

      const data = await apiClient.get<any>(`/api/prompts?${query.toString()}`);
      setPrompts(data || []);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsLoading(false);
    }
  }, [status, type]);

  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  return { prompts, isLoading, refresh: fetchPrompts };
}
