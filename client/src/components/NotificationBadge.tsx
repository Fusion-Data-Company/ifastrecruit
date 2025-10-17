import { cn } from "@/lib/utils";

interface NotificationBadgeProps {
  count: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function NotificationBadge({ count, className, size = 'md' }: NotificationBadgeProps) {
  if (count <= 0) return null;

  const sizeClasses = {
    sm: 'h-4 min-w-4 text-[10px]',
    md: 'h-5 min-w-5 text-xs',
    lg: 'h-6 min-w-6 text-sm'
  };

  return (
    <span 
      className={cn(
        "inline-flex items-center justify-center rounded-full",
        "bg-red-500 text-white font-medium",
        "px-1",
        sizeClasses[size],
        className
      )}
      data-testid={`badge-count-${count}`}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}