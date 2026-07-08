import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon | ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("card-soft flex flex-col items-center justify-center gap-3 border-dashed p-10 text-center", className)}>
      {Icon ? (
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary-deep">
          <Icon className="h-6 w-6" />
        </span>
      ) : null}
      <p className="font-display text-xl font-semibold text-foreground">{title}</p>
      {description ? <p className="max-w-md text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
