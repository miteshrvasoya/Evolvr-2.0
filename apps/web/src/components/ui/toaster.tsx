'use client';

import * as React from 'react';
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  progressBarColors,
  toastIcons,
} from '@/components/ui/toast';
import { useToast } from '@/lib/hooks/use-toast';

// Per-toast progress bar that animates and pauses on hover
function ToastProgressBar({
  duration,
  variant,
  open,
}: {
  duration: number;
  variant?: string;
  open?: boolean;
}) {
  const [width, setWidth] = React.useState(100);
  const [paused, setPaused] = React.useState(false);
  const startTimeRef = React.useRef<number>(Date.now());
  const elapsedRef = React.useRef<number>(0);
  const rafRef = React.useRef<number | null>(null);

  // Animate the bar
  React.useEffect(() => {
    if (!open) return;

    const tick = () => {
      if (!paused) {
        const elapsed = elapsedRef.current + (Date.now() - startTimeRef.current);
        const pct = Math.max(0, 100 - (elapsed / duration) * 100);
        setWidth(pct);
        if (pct > 0) {
          rafRef.current = requestAnimationFrame(tick);
        }
      } else {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    startTimeRef.current = Date.now();
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, paused, duration]);

  const handleMouseEnter = () => {
    elapsedRef.current += Date.now() - startTimeRef.current;
    setPaused(true);
  };

  const handleMouseLeave = () => {
    startTimeRef.current = Date.now();
    setPaused(false);
  };

  const barColor = progressBarColors[variant ?? 'default'] ?? progressBarColors.default;

  return (
    <div
      className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/10 overflow-hidden rounded-b-xl"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className={`h-full ${barColor} transition-none`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(({ id, title, description, action, variant, duration, open, ...props }) => {
        const resolvedVariant = variant ?? 'default';
        const icon = toastIcons[resolvedVariant] ?? toastIcons.default;
        const resolvedDuration = duration ?? 5000;

        return (
          <Toast key={id} variant={variant} open={open} {...props}>
            {/* Left accent bar */}
            <div
              className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl ${
                resolvedVariant === 'destructive'
                  ? 'bg-red-500'
                  : resolvedVariant === 'success'
                    ? 'bg-emerald-500'
                    : resolvedVariant === 'warning'
                      ? 'bg-amber-500'
                      : resolvedVariant === 'info'
                        ? 'bg-blue-500'
                        : 'bg-white/30'
              }`}
            />

            {/* Icon */}
            <div className="pl-2">{icon}</div>

            {/* Content */}
            <div className="grid gap-0.5 flex-1 min-w-0 pr-6">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>

            {action}
            <ToastClose />

            {/* Auto-dismiss progress bar */}
            <ToastProgressBar
              duration={resolvedDuration}
              variant={resolvedVariant}
              open={open}
            />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
