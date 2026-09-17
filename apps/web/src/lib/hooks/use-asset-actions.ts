'use client';

import { useState, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

interface AssetActionState {
  isRetrying: boolean;
  isImproving: boolean;
  isUploading: boolean;
  isEditingPrompt: boolean;
  isGenerating: boolean;
  error: string | null;
}

export function useAssetActions(ideaId: string, onSuccess?: () => void) {
  const [state, setState] = useState<AssetActionState>({
    isRetrying: false,
    isImproving: false,
    isUploading: false,
    isEditingPrompt: false,
    isGenerating: false,
    error: null,
  });

  function setLoading(key: keyof AssetActionState, value: boolean) {
    setState(s => ({ ...s, [key]: value, error: null }));
  }

  function setError(msg: string) {
    setState(s => ({ ...s, error: msg }));
  }

  /**
   * Retry failed asset generation using the latest prompt (same prompt).
   * Returns { alreadyRunning: true } if a job is already in progress.
   */
  const retryAsset = useCallback(async (assetType: string): Promise<{ alreadyRunning?: boolean } | void> => {
    setLoading('isRetrying', true);
    try {
      const response = await fetch(`/api/content/assets/${assetType}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ideaId }),
      });
      const data = await response.json();

      if (response.status === 409) {
        return { alreadyRunning: true };
      }
      if (!response.ok) {
        throw new Error(data.error || 'Retry failed');
      }
      onSuccess?.();
    } catch (e: any) {
      setError(e.message || 'Failed to retry asset generation');
      throw e;
    } finally {
      setState(s => ({ ...s, isRetrying: false }));
    }
  }, [ideaId, onSuccess]);

  /**
   * Ask LLM to improve the prompt. Returns the new prompt text.
   */
  const improvePrompt = useCallback(async (assetType: string): Promise<string> => {
    setLoading('isImproving', true);
    try {
      const data = await apiClient.post<any>(`/api/content/ideas/${ideaId}/improve-prompt`, { assetType });
      onSuccess?.();
      return data.data.improvedPrompt;
    } catch (e: any) {
      setError(e.message || 'Failed to improve prompt');
      throw e;
    } finally {
      setState(s => ({ ...s, isImproving: false }));
    }
  }, [ideaId, onSuccess]);

  /**
   * Trigger generation with a specific prompt ID.
   */
  const generateWithPrompt = useCallback(async (promptId: string, assetType: string): Promise<{ alreadyRunning?: boolean } | void> => {
    setLoading('isGenerating', true);
    try {
      const response = await fetch(`/api/content/ideas/${ideaId}/generate-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ promptId, assetType }),
      });
      const data = await response.json();

      if (response.status === 409) return { alreadyRunning: true };
      if (!response.ok) throw new Error(data.error || 'Generation failed');
      onSuccess?.();
    } catch (e: any) {
      setError(e.message || 'Failed to generate asset');
      throw e;
    } finally {
      setState(s => ({ ...s, isGenerating: false }));
    }
  }, [ideaId, onSuccess]);

  /**
   * Save a user-edited prompt as a new version.
   */
  const editPrompt = useCallback(async (promptId: string, promptText: string): Promise<string> => {
    setLoading('isEditingPrompt', true);
    try {
      const data = await apiClient.patch<any>(`/api/content/prompts/${promptId}`, { promptText });
      onSuccess?.();
      return data.data.newPromptId;
    } catch (e: any) {
      setError(e.message || 'Failed to save edited prompt');
      throw e;
    } finally {
      setState(s => ({ ...s, isEditingPrompt: false }));
    }
  }, [onSuccess]);

  /**
   * Upload a manually generated asset and attach it to the content idea.
   */
  const uploadAsset = useCallback(async (file: File): Promise<void> => {
    setLoading('isUploading', true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`/api/content/ideas/${ideaId}/asset`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!response.ok) {
        const d = await response.json().catch(() => ({}));
        throw new Error(d.error || 'Upload failed');
      }
      onSuccess?.();
    } catch (e: any) {
      setError(e.message || 'Upload failed');
      throw e;
    } finally {
      setState(s => ({ ...s, isUploading: false }));
    }
  }, [ideaId, onSuccess]);

  /**
   * Copy text to clipboard. Returns true on success.
   */
  const copyToClipboard = useCallback(async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    }
  }, []);

  return {
    ...state,
    retryAsset,
    improvePrompt,
    generateWithPrompt,
    editPrompt,
    uploadAsset,
    copyToClipboard,
  };
}
