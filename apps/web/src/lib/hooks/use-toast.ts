'use client';

import * as React from 'react';
import type { ToastActionElement, ToastProps } from '@/components/ui/toast';

const TOAST_LIMIT = 5;
const TOAST_REMOVE_DELAY = 300; // ms after dismiss animation before unmounting

type ToastVariant = 'default' | 'destructive' | 'success' | 'warning' | 'info';

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
  variant?: ToastVariant;
  /** Auto-dismiss duration in ms. Defaults to 5000. */
  duration?: number;
};

type Action =
  | { type: 'ADD_TOAST'; toast: ToasterToast }
  | { type: 'UPDATE_TOAST'; toast: Partial<ToasterToast> & { id: string } }
  | { type: 'DISMISS_TOAST'; toastId?: string }
  | { type: 'REMOVE_TOAST'; toastId?: string };

interface State {
  toasts: ToasterToast[];
}

let count = 0;
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

function addToRemoveQueue(toastId: string, dispatch: React.Dispatch<Action>) {
  if (toastTimeouts.has(toastId)) return;
  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    dispatch({ type: 'REMOVE_TOAST', toastId });
  }, TOAST_REMOVE_DELAY);
  toastTimeouts.set(toastId, timeout);
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'ADD_TOAST':
      return { ...state, toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT) };
    case 'UPDATE_TOAST':
      return {
        ...state,
        toasts: state.toasts.map((t) => (t.id === action.toast.id ? { ...t, ...action.toast } : t)),
      };
    case 'DISMISS_TOAST': {
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toastId || !action.toastId ? { ...t, open: false } : t,
        ),
      };
    }
    case 'REMOVE_TOAST':
      return {
        ...state,
        toasts: action.toastId ? state.toasts.filter((t) => t.id !== action.toastId) : [],
      };
  }
}

const listeners: Array<(state: State) => void> = [];
let memoryState: State = { toasts: [] };

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => listener(memoryState));
}

type ToastInput = Omit<ToasterToast, 'id'>;

function toast(props: ToastInput) {
  const id = genId();
  const duration = props.duration ?? 5000;
  const dismiss = () => dispatch({ type: 'DISMISS_TOAST', toastId: id });

  dispatch({
    type: 'ADD_TOAST',
    toast: {
      ...props,
      id,
      duration,
      open: true,
      onOpenChange: (open) => { if (!open) dismiss(); },
    },
  });

  // Schedule auto-dismiss after duration
  const autoDismissTimer = setTimeout(() => {
    dismiss();
  }, duration);

  return {
    id,
    dismiss,
    update: (updateProps: Partial<ToastInput>) =>
      dispatch({ type: 'UPDATE_TOAST', toast: { id, ...updateProps } }),
    cancel: () => clearTimeout(autoDismissTimer),
  };
}

/** Convenience helpers */
toast.success = (title: string, description?: string, opts?: Partial<ToastInput>) =>
  toast({ variant: 'success', title, description, ...opts });

toast.error = (title: string, description?: string, opts?: Partial<ToastInput>) =>
  toast({ variant: 'destructive', title, description, ...opts });

toast.warning = (title: string, description?: string, opts?: Partial<ToastInput>) =>
  toast({ variant: 'warning', title, description, ...opts });

toast.info = (title: string, description?: string, opts?: Partial<ToastInput>) =>
  toast({ variant: 'info', title, description, ...opts });

function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const idx = listeners.indexOf(setState);
      if (idx > -1) listeners.splice(idx, 1);
    };
  }, []);

  // Schedule removal for dismissed toasts (after close animation)
  React.useEffect(() => {
    state.toasts
      .filter((t) => !t.open)
      .forEach((t) => addToRemoveQueue(t.id, dispatch));
  }, [state.toasts]);

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: 'DISMISS_TOAST', toastId }),
  };
}

export { useToast, toast };
