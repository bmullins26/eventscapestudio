import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "primary" | "success" | "warning" | "destructive" | "info";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground border-transparent",
  primary: "bg-primary-soft text-primary-deep border-transparent",
  success: "bg-success/15 text-success border-transparent",
  warning: "bg-warning/20 text-warning-foreground border-transparent",
  destructive: "bg-destructive/10 text-destructive border-transparent",
  info: "bg-secondary text-secondary-foreground border-transparent",
};

const STATUS_TONE: Record<string, Tone> = {
  draft: "neutral",
  published: "primary",
  in_progress: "success",
  completed: "info",
  archived: "neutral",
  pending: "warning",
  approved: "success",
  waitlisted: "info",
  rejected: "destructive",
  withdrawn: "neutral",
  unpaid: "warning",
  partial: "info",
  paid: "success",
  refunded: "neutral",
  available: "neutral",
  held: "warning",
  assigned: "primary",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const tone = STATUS_TONE[status] ?? "neutral";
  const label = status.replace(/_/g, " ");
  return (
    <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize", toneClasses[tone], className)}>
      {label}
    </Badge>
  );
}
