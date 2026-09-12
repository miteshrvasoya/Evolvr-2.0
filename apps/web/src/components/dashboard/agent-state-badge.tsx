import { cn } from '@/lib/utils';

// Covers both AgentState enum values AND AgentRunStatus DB values
const STATE_CONFIG: Record<string, {
  label: string;
  dot: string;
  pulse: boolean;
  textColor: string;
  bgColor: string;
  borderColor: string;
}> = {
  // Run statuses (DB)
  RUNNING:    { label: 'Running',    dot: 'bg-blue-500',   pulse: true,  textColor: 'text-blue-700',   bgColor: 'bg-blue-50',   borderColor: 'border-blue-200' },
  running:    { label: 'Running',    dot: 'bg-blue-500',   pulse: true,  textColor: 'text-blue-700',   bgColor: 'bg-blue-50',   borderColor: 'border-blue-200' },
  WAITING:    { label: 'Waiting',    dot: 'bg-amber-400',  pulse: false, textColor: 'text-amber-700',  bgColor: 'bg-amber-50',  borderColor: 'border-amber-200' },
  waiting:    { label: 'Waiting',    dot: 'bg-amber-400',  pulse: false, textColor: 'text-amber-700',  bgColor: 'bg-amber-50',  borderColor: 'border-amber-200' },
  PAUSED:     { label: 'Paused',     dot: 'bg-slate-400',  pulse: false, textColor: 'text-slate-600',  bgColor: 'bg-slate-50',  borderColor: 'border-slate-200' },
  paused:     { label: 'Paused',     dot: 'bg-slate-400',  pulse: false, textColor: 'text-slate-600',  bgColor: 'bg-slate-50',  borderColor: 'border-slate-200' },
  RETRYING:   { label: 'Retrying',   dot: 'bg-orange-500', pulse: true,  textColor: 'text-orange-700', bgColor: 'bg-orange-50', borderColor: 'border-orange-200' },
  retrying:   { label: 'Retrying',   dot: 'bg-orange-500', pulse: true,  textColor: 'text-orange-700', bgColor: 'bg-orange-50', borderColor: 'border-orange-200' },
  BLOCKED:    { label: 'Blocked',    dot: 'bg-red-500',    pulse: false, textColor: 'text-red-700',    bgColor: 'bg-red-50',    borderColor: 'border-red-200' },
  blocked:    { label: 'Blocked',    dot: 'bg-red-500',    pulse: false, textColor: 'text-red-700',    bgColor: 'bg-red-50',    borderColor: 'border-red-200' },
  FAILED:     { label: 'Failed',     dot: 'bg-red-600',    pulse: false, textColor: 'text-red-700',    bgColor: 'bg-red-50',    borderColor: 'border-red-200' },
  failed:     { label: 'Failed',     dot: 'bg-red-600',    pulse: false, textColor: 'text-red-700',    bgColor: 'bg-red-50',    borderColor: 'border-red-200' },
  COMPLETED:  { label: 'Completed',  dot: 'bg-emerald-500',pulse: false, textColor: 'text-emerald-700',bgColor: 'bg-emerald-50',borderColor: 'border-emerald-200' },
  completed:  { label: 'Completed',  dot: 'bg-emerald-500',pulse: false, textColor: 'text-emerald-700',bgColor: 'bg-emerald-50',borderColor: 'border-emerald-200' },
  CANCELLED:  { label: 'Cancelled',  dot: 'bg-slate-400',  pulse: false, textColor: 'text-slate-600',  bgColor: 'bg-slate-50',  borderColor: 'border-slate-200' },
  cancelled:  { label: 'Cancelled',  dot: 'bg-slate-400',  pulse: false, textColor: 'text-slate-600',  bgColor: 'bg-slate-50',  borderColor: 'border-slate-200' },
  QUEUED:     { label: 'Queued',     dot: 'bg-purple-400', pulse: true,  textColor: 'text-purple-700', bgColor: 'bg-purple-50', borderColor: 'border-purple-200' },
  queued:     { label: 'Queued',     dot: 'bg-purple-400', pulse: true,  textColor: 'text-purple-700', bgColor: 'bg-purple-50', borderColor: 'border-purple-200' },
  // Idle / default
  IDLE:       { label: 'Idle',       dot: 'bg-slate-300',  pulse: false, textColor: 'text-slate-500',  bgColor: 'bg-slate-50',  borderColor: 'border-slate-200' },
  idle:       { label: 'Idle',       dot: 'bg-slate-300',  pulse: false, textColor: 'text-slate-500',  bgColor: 'bg-slate-50',  borderColor: 'border-slate-200' },
  // Legacy AgentState values
  OBSERVING:  { label: 'Observing',  dot: 'bg-cyan-500',   pulse: true,  textColor: 'text-cyan-700',   bgColor: 'bg-cyan-50',   borderColor: 'border-cyan-200' },
  PLANNING:   { label: 'Planning',   dot: 'bg-purple-500', pulse: true,  textColor: 'text-purple-700', bgColor: 'bg-purple-50', borderColor: 'border-purple-200' },
  CREATING:   { label: 'Creating',   dot: 'bg-pink-500',   pulse: true,  textColor: 'text-pink-700',   bgColor: 'bg-pink-50',   borderColor: 'border-pink-200' },
  LEARNING:   { label: 'Learning',   dot: 'bg-indigo-500', pulse: true,  textColor: 'text-indigo-700', bgColor: 'bg-indigo-50', borderColor: 'border-indigo-200' },
  WAITING_APPROVAL: { label: 'Needs Approval', dot: 'bg-yellow-500', pulse: true, textColor: 'text-yellow-700', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-200' },
  AUTH_REQUIRED:    { label: 'Auth Required',  dot: 'bg-red-500',    pulse: false, textColor: 'text-red-700',    bgColor: 'bg-red-50',    borderColor: 'border-red-200' },
};

interface AgentStateBadgeProps {
  state: string;
  className?: string;
  size?: 'sm' | 'md';
}

export function AgentStateBadge({ state, className, size = 'md' }: AgentStateBadgeProps) {
  const cfg = STATE_CONFIG[state] ?? STATE_CONFIG['IDLE'] ?? {
    label: state, dot: 'bg-slate-300', pulse: false,
    textColor: 'text-slate-500', bgColor: 'bg-slate-50', borderColor: 'border-slate-200',
  };
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full border font-medium',
      size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
      cfg.textColor, cfg.bgColor, cfg.borderColor,
      className,
    )}>
      <span className="relative flex h-2 w-2 flex-shrink-0">
        <span className={cn('h-2 w-2 rounded-full', cfg.dot)} />
        {cfg.pulse && (
          <span className={cn('absolute inset-0 h-2 w-2 rounded-full animate-ping opacity-75', cfg.dot)} />
        )}
      </span>
      {cfg.label}
    </span>
  );
}

export { STATE_CONFIG };

